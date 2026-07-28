import { getDb, setPostStatus, listRepos, getAccount } from '../db';
import { Post } from '../types';
import { postToX } from './postToX';
import { postToLinkedIn } from './postToLinkedIn';
import { uploadMediaX, uploadMediaLinkedIn } from './uploadMedia';
import keytar from 'keytar';
import { cleanupScreenshot } from '../generation/renderSnippet';

const SERVICE = 'devlog';

export async function approveAndMaybePublish(postId: number, editedContent: string | null = null): Promise<Post> {
  const db = getDb();
  const post = setPostStatus(db, postId, 'approved', editedContent);
  const repo = listRepos(db).find((row) => row.id === post.repo_id);
  if (!repo) {
    db.close();
    return post;
  }

  const platforms = JSON.parse(repo.platforms || '[]') as string[];
  const canAutoPost = repo.visibility === 'public' && platforms.length > 0;

  if (!canAutoPost) {
    db.close();
    return post;
  }

  const postErrors: string[] = [];

  for (const platform of platforms) {
    try {
      if (platform === 'x') {
        let mediaIds: string[] | undefined;
        if (post.media_path) {
          const account = getAccount(db, 'x');
          if (account) {
            const token = await keytar.getPassword(SERVICE, account.token_ref);
            if (token) {
              mediaIds = [await uploadMediaX(token, post.media_path)];
            }
          }
        }
        await postToX(post, mediaIds);
      } else if (platform === 'linkedin') {
        let mediaUrn: string | undefined;
        if (post.media_path) {
          const account = getAccount(db, 'linkedin');
          if (account) {
            const token = await keytar.getPassword(SERVICE, account.token_ref);
            if (token) {
              const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (meRes.ok) {
                const meData = (await meRes.json()) as { sub?: string };
                if (meData.sub) {
                  mediaUrn = await uploadMediaLinkedIn(token, meData.sub, post.media_path);
                }
              }
            }
          }
        }
        await postToLinkedIn(post, mediaUrn);
      }
    } catch (err) {
      postErrors.push(`${platform}: ${(err as Error).message}`);
    }
  }

  if (post.media_path) {
    cleanupScreenshot(post.media_path);
  }

  if (postErrors.length === platforms.length) {
    console.error('[devlog] Auto-post failed on all platforms:', postErrors.join('; '));
    const failed = setPostStatus(db, postId, 'failed', editedContent);
    db.close();
    return failed;
  }

  const posted = setPostStatus(db, postId, 'posted', editedContent);
  db.close();
  return posted;
}
