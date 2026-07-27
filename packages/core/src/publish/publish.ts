import { getDb, setPostStatus, listRepos } from '../db';
import { Post } from '../types';
import { postToX } from './postToX';
import { postToLinkedIn } from './postToLinkedIn';

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
        await postToX(post);
      } else if (platform === 'linkedin') {
        await postToLinkedIn(post);
      }
    } catch (err) {
      postErrors.push(`${platform}: ${(err as Error).message}`);
    }
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
