import http from 'http';
import crypto from 'crypto';
import { URL } from 'url';
import keytar from 'keytar';
import fetch from 'node-fetch';
import { getDb, listAccounts, deleteAccount, upsertAccount } from '../db';
import { Account, OAuthTokenSet } from '../types';

const SERVICE = 'devlog';
const LI_AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LI_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LI_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

function createState(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function exchangeCode(args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<OAuthTokenSet> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: args.redirectUri,
    client_id: args.clientId,
    client_secret: args.clientSecret,
  });

  const res = await fetch(LI_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`LinkedIn token exchange failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  return { accessToken: data.access_token, refreshToken: '', expiresAt };
}

async function fetchProfile(accessToken: string): Promise<{ sub: string; name: string }> {
  const res = await fetch(LI_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`LinkedIn profile lookup failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { sub?: string; name?: string };
  return { sub: data.sub || 'unknown', name: data.name || 'LinkedIn User' };
}

export async function connectLinkedInAccount(args: {
  clientId: string;
  clientSecret: string;
  callbackPort: number;
  openExternal: (url: string) => Promise<void> | void;
}): Promise<Account> {
  const state = createState();
  const redirectUri = `http://127.0.0.1:${args.callbackPort}/callback/linkedin`;
  const scope = 'w_member_social profile openid';
  const authorizeUrl = new URL(LI_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', args.clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);

  const code = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      if (!settled) {
        settled = true;
        server.close();
      }
    };

    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url || '/', redirectUri);
      if (requestUrl.pathname !== '/callback/linkedin') {
        res.writeHead(404).end('Not found');
        return;
      }
      const returnedState = requestUrl.searchParams.get('state');
      const returnedCode = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');
      const errorDesc = requestUrl.searchParams.get('error_description');
      console.log('[devlog] LinkedIn callback:', { returnedState: returnedState?.slice(0, 8), state: state.slice(0, 8), hasCode: !!returnedCode, error, errorDesc });
      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h3>LinkedIn Error</h3><p>${error}: ${errorDesc}</p><p>Close this tab and try again.</p>`);
        reject(new Error(`LinkedIn OAuth error: ${error} — ${errorDesc}`));
        cleanup();
        return;
      }
      if (!returnedState || returnedState !== state || !returnedCode) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h3>Invalid Callback</h3><p>State mismatch or missing code. Close this tab and try again.</p>`);
        reject(new Error('Invalid LinkedIn OAuth callback'));
        cleanup();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('devlog connected to LinkedIn. You can close this tab.');
      resolve(returnedCode);
      cleanup();
    });

    const timeout = setTimeout(() => {
      reject(new Error('LinkedIn OAuth timed out — no callback received within 5 minutes'));
      cleanup();
    }, 5 * 60 * 1000);

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${args.callbackPort} is in use. Close the other app using it and try again.`));
      } else {
        reject(err);
      }
    });

    server.listen(args.callbackPort, '127.0.0.1', async () => {
      try {
        await args.openExternal(authorizeUrl.toString());
      } catch (err) {
        reject(err);
        cleanup();
      }
    });

    server.on('close', () => clearTimeout(timeout));
  });

  const tokens = await exchangeCode({
    code,
    clientId: args.clientId,
    clientSecret: args.clientSecret,
    redirectUri,
  });
  const profile = await fetchProfile(tokens.accessToken);
  const handle = profile.name || profile.sub;
  const tokenRef = `${SERVICE}:linkedin:${profile.sub}`;

  await keytar.setPassword(SERVICE, tokenRef, tokens.accessToken);

  const db = getDb();
  const account = upsertAccount(db, {
    platform: 'linkedin',
    handle,
    tokenRef,
    refreshTokenRef: null,
    expiryAt: tokens.expiresAt,
    status: 'connected',
  });
  db.close();
  return account;
}

export function listLinkedInAccounts(): Account[] {
  const db = getDb();
  const accounts = listAccounts(db).filter((account) => account.platform === 'linkedin');
  db.close();
  return accounts;
}

export async function disconnectLinkedInAccount(handle: string): Promise<void> {
  const db = getDb();
  const account = listAccounts(db).find((row) => row.platform === 'linkedin' && row.handle === handle);
  if (account) {
    await keytar.deletePassword(SERVICE, account.token_ref);
    deleteAccount(db, 'linkedin', handle);
  }
  db.close();
}
