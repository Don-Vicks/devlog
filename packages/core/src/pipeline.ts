import { loadRepoConfig } from './config/loadConfig';
import { resolveProjectName } from './extraction/projectName';
import { extractCommitPayload } from './extraction/git';
import { redact, redactKnownNames } from './redaction/redact';
import { generatePost } from './generation/generatePost';
import { extractSnippet } from './generation/extractSnippet';
import { renderSnippet } from './generation/renderSnippet';
import { getDb, upsertRepo, createPost, recentVoiceExamples } from './db';
import { notifyQueue } from './queue/notify';
import { Platform, Post, PostMode } from './types';
import fs from 'fs';

const BLOCKED_NAMES = (process.env.DEVLOG_BLOCKED_NAMES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function generateCodeScreenshot(
  diff: string | null,
  commitMessage: string,
  postId: number
): Promise<string | null> {
  if (!diff) return null;

  try {
    const snippet = await extractSnippet(diff, commitMessage);
    if (!snippet) return null;

    const outputPath = renderSnippet(snippet.snippet, snippet.language, postId);
    return outputPath;
  } catch {
    return null;
  }
}

export async function processCommit(repoPath: string): Promise<Post[]> {
  const db = getDb();
  const config = loadRepoConfig(repoPath);
  const { name: projectName } = resolveProjectName(repoPath, config);

  const repo = upsertRepo(db, {
    repoPath,
    displayName: projectName,
    visibility: config.visibility,
    projectTag: config.project_tag,
    voiceProfile: config.voice_profile,
    platforms: config.platforms,
  });

  const commit = extractCommitPayload(repoPath, config.visibility);

  let diffForModel: string | null = null;
  if (commit.diff) {
    const { clean } = redact(commit.diff);
    diffForModel = redactKnownNames(clean, BLOCKED_NAMES);
  }

  const voiceExamples = recentVoiceExamples(db, 5);
  const platforms: Platform[] = config.platforms?.length ? config.platforms : ['x'];
  const createdPosts: Post[] = [];

  let mediaPath: string | null = null;
  let snippetExtracted = false;

  for (const platform of platforms) {
    const mode: PostMode = platform === 'linkedin'
      ? 'single'
      : commit.filesChanged.length > 4 ? 'thread' : 'single';

    const generated = await generatePost({
      visibility: config.visibility,
      projectName,
      projectTag: config.project_tag,
      commitMessage: redactKnownNames(commit.message, BLOCKED_NAMES),
      diff: diffForModel,
      manualSummary: commit.manualSummary,
      mode,
      platform,
      voiceProfile: config.voice_profile,
      voiceExamples,
    });

    if (!snippetExtracted && config.visibility === 'public') {
      mediaPath = await generateCodeScreenshot(
        diffForModel,
        redactKnownNames(commit.message, BLOCKED_NAMES),
        0
      );
      snippetExtracted = true;
    }

    const post = createPost(db, {
      repoId: repo.id,
      sourceCommit: commit.hash,
      platform,
      content: Array.isArray(generated) ? generated[0] : generated,
      threadParts: Array.isArray(generated) ? generated : null,
      mediaPath: mediaPath,
    });
    createdPosts.push(post);

    if (mediaPath) {
      const finalPath: string = mediaPath.replace(/\/0\.png$/, `/${post.id}.png`);
      if (mediaPath !== finalPath) {
        if (fs.existsSync(mediaPath)) {
          fs.renameSync(mediaPath, finalPath);
          mediaPath = finalPath;
        }
      }
    }
  }

  await notifyQueue(createdPosts, repo);
  return createdPosts;
}
