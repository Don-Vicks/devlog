import fetch from 'node-fetch';
import keytar from 'keytar';
import { getDb, getAccount, upsertAccount } from '../db';
import { Account, Post } from '../types';

const SERVICE = 'devlog';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const TWEET_URL = 'https://api.twitter.com/2/tweets';

async function refreshAccessToken(account: Account): Promise<Account> {
  if (!account.refresh_token_ref) {
    throw new Error('No X refresh token reference stored');
  }

  const refreshToken = await keytar.getPassword(SERVICE, account.refresh_token_ref);
  if (!refreshToken) {
    throw new Error('Stored X refresh token not found in keychain');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.X_CLIENT_ID || '',
    }),
  });

  if (!res.ok) {
    throw new Error(`X token refresh failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  await keytar.setPassword(SERVICE, account.token_ref, data.access_token);
  if (data.refresh_token) {
    await keytar.setPassword(SERVICE, account.refresh_token_ref, data.refresh_token);
  }

  const db = getDb();
  const updated = upsertAccount(db, {
    platform: 'x',
    handle: account.handle,
    tokenRef: account.token_ref,
    refreshTokenRef: account.refresh_token_ref,
    expiryAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    status: 'connected',
  });
  db.close();
  return updated;
}

async function publishTweet(accessToken: string, text: string, replyToId?: string, mediaIds?: string[]): Promise<string> {
  const payload: Record<string, unknown> = { text };
  if (replyToId) {
    payload.reply = { in_reply_to_tweet_id: replyToId };
  }
  if (mediaIds && mediaIds.length > 0) {
    payload.media = { media_ids: mediaIds };
  }

  const res = await fetch(TWEET_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`X post failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { data?: { id?: string } };
  return data.data?.id || '';
}

export async function postToX(post: Post, mediaIds?: string[]): Promise<string[]> {
  const db = getDb();
  let account = getAccount(db, 'x');
  db.close();

  if (!account) {
    throw new Error('No connected X account found');
  }

  if (account.expiry_at && Date.parse(account.expiry_at) - Date.now() < 60_000) {
    account = await refreshAccessToken(account);
  }

  const token = await keytar.getPassword(SERVICE, account.token_ref);
  if (!token) {
    throw new Error('Stored X token not found in keychain');
  }

  const parts = post.thread_parts ? (JSON.parse(post.thread_parts) as string[]) : [post.content];
  const tweetIds: string[] = [];
  let replyToId: string | undefined;

  for (let i = 0; i < parts.length; i++) {
    const isFirst = i === 0;
    const tweetId = await publishTweet(token, parts[i], replyToId, isFirst ? mediaIds : undefined);
    tweetIds.push(tweetId);
    replyToId = tweetId;
  }

  return tweetIds;
}
