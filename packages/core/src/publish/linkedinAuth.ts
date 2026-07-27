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

function base64Url(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createPkcePair(): { verifier: string; challenge: string; state: string } {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  const state = base64Url(crypto.randomBytes(16));
  return { verifier, challenge, state };
}

async function exchangeCode(args: {
  code: string;
  codeVerifier: string;
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
    code_verifier: args.codeVerifier,
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
  const { verifier, challenge, state } = createPkcePair();
  const redirectUri = `http://127.0.0.1:${args.callbackPort}/callback/linkedin`;
  const scope = 'w_member_social profile openid';
  const authorizeUrl = new URL(LI_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', args.clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url || '/', redirectUri);
      if (requestUrl.pathname !== '/callback/linkedin') {
        res.writeHead(404).end('Not found');
        return;
      }
      const returnedState = requestUrl.searchParams.get('state');
      const returnedCode = requestUrl.searchParams.get('code');
      if (!returnedState || returnedState !== state || !returnedCode) {
        res.writeHead(400).end('Invalid OAuth callback');
        reject(new Error('Invalid LinkedIn OAuth callback'));
        server.close();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('devlog connected to LinkedIn. You can close this tab.');
      resolve(returnedCode);
      server.close();
    });

    server.listen(args.callbackPort, '127.0.0.1', async () => {
      try {
        await args.openExternal(authorizeUrl.toString());
      } catch (err) {
        reject(err);
        server.close();
      }
    });

    server.on('error', reject);
  });

  const tokens = await exchangeCode({
    code,
    codeVerifier: verifier,
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
