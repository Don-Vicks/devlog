import fetch from 'node-fetch';
import keytar from 'keytar';
import { getDb, getAccount, upsertAccount } from '../db';
import { Account, Post } from '../types';

const SERVICE = 'devlog';
const LI_POST_URL = 'https://api.linkedin.com/v2/ugcPosts';

export async function postToLinkedIn(post: Post, mediaUrn?: string): Promise<string[]> {
  const db = getDb();
  let account = getAccount(db, 'linkedin');
  db.close();

  if (!account) {
    throw new Error('No connected LinkedIn account found');
  }

  // LinkedIn access tokens don't use standard refresh — re-auth is needed when expired.
  if (account.expiry_at && Date.parse(account.expiry_at) < Date.now()) {
    throw new Error('LinkedIn token expired — please reconnect your LinkedIn account in Accounts tab');
  }

  const token = await keytar.getPassword(SERVICE, account.token_ref);
  if (!token) {
    throw new Error('Stored LinkedIn token not found in keychain');
  }

  // Extract author URN from the token — we need the person ID.
  // LinkedIn user info endpoint to get the person URN.
  const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) {
    throw new Error(`LinkedIn profile lookup failed (${meRes.status}): ${await meRes.text()}`);
  }
  const meData = (await meRes.json()) as { sub?: string };
  const personId = meData.sub;
  if (!personId) {
    throw new Error('Could not determine LinkedIn person ID');
  }

  const content = post.content;
  const shareContent: Record<string, unknown> = {
    shareCommentary: { text: content },
    shareMediaCategory: 'NONE',
  };

  const specificContent: Record<string, unknown> = {
    'com.linkedin.ugc.ShareContent': shareContent,
  };

  const payload: Record<string, unknown> = {
    author: `urn:li:person:${personId}`,
    lifecycleState: 'PUBLISHED',
    specificContent,
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  if (mediaUrn) {
    shareContent['media'] = {
      status: 'READY',
      media: mediaUrn,
    };
  }

  const res = await fetch(LI_POST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`LinkedIn post failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { id?: string };
  return [data.id || ''];
}
