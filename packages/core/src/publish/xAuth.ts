import http from 'http';
import crypto from 'crypto';
import { URL } from 'url';
import keytar from 'keytar';
import fetch from 'node-fetch';
import { getDb, listAccounts, deleteAccount, upsertAccount } from '../db';
import { Account, OAuthTokenSet, Platform } from '../types';

const SERVICE = 'devlog';
const X_AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize';
const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const X_USER_URL = 'https://api.twitter.com/2/users/me';

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
  clientSecret?: string;
  redirectUri: string;
}): Promise<OAuthTokenSet> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    code_verifier: args.codeVerifier,
  });

  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (args.clientSecret) {
    const token = Buffer.from(`${args.clientId}:${args.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${token}`;
  }

  const res = await fetch(X_TOKEN_URL, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    throw new Error(`X token exchange failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt };
}

async function fetchHandle(accessToken: string): Promise<string> {
  const res = await fetch(X_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`X profile lookup failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { data?: { username?: string } };
  return data.data?.username || 'unknown';
}

export async function connectXAccount(args: {
  clientId: string;
  clientSecret?: string;
  callbackPort: number;
  openExternal: (url: string) => Promise<void> | void;
}): Promise<Account> {
  const { verifier, challenge, state } = createPkcePair();
  const redirectUri = `http://127.0.0.1:${args.callbackPort}/callback`;
  const scope = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'].join(' ');
  const authorizeUrl = new URL(X_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', args.clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

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
      if (requestUrl.pathname !== '/callback') {
        res.writeHead(404).end('Not found');
        return;
      }
      const returnedState = requestUrl.searchParams.get('state');
      const returnedCode = requestUrl.searchParams.get('code');
      if (!returnedState || returnedState !== state || !returnedCode) {
        res.writeHead(400).end('Invalid OAuth callback');
        reject(new Error('Invalid OAuth callback'));
        cleanup();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('devlog connected. You can close this tab.');
      resolve(returnedCode);
      cleanup();
    });

    const timeout = setTimeout(() => {
      reject(new Error('OAuth timed out — no callback received within 5 minutes'));
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

  const tokens = await exchangeCode({ code, codeVerifier: verifier, clientId: args.clientId, clientSecret: args.clientSecret, redirectUri });
  const handle = await fetchHandle(tokens.accessToken);
  const tokenRef = `${SERVICE}:x:${handle}`;
  const refreshRef = `${tokenRef}:refresh`;

  await keytar.setPassword(SERVICE, tokenRef, tokens.accessToken);
  await keytar.setPassword(SERVICE, refreshRef, tokens.refreshToken);

  const db = getDb();
  const account = upsertAccount(db, {
    platform: 'x',
    handle,
    tokenRef,
    refreshTokenRef: refreshRef,
    expiryAt: tokens.expiresAt,
    status: 'connected',
  });
  db.close();
  return account;
}

export function listXAccounts(): Account[] {
  const db = getDb();
  const accounts = listAccounts(db).filter((account) => account.platform === 'x');
  db.close();
  return accounts;
}

export async function disconnectXAccount(handle: string): Promise<void> {
  const db = getDb();
  const account = listAccounts(db).find((row) => row.platform === 'x' && row.handle === handle);
  if (account) {
    await keytar.deletePassword(SERVICE, account.token_ref);
    if (account.refresh_token_ref) {
      await keytar.deletePassword(SERVICE, account.refresh_token_ref);
    }
    deleteAccount(db, 'x', handle);
  }
  db.close();
}
