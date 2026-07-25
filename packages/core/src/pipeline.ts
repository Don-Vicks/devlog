import { loadRepoConfig } from './config/loadConfig';
import { resolveProjectName } from './extraction/projectName';
import { extractCommitPayload } from './extraction/git';
import { redact, redactKnownNames } from './redaction/redact';
import { generatePost } from './generation/generatePost';
import { getDb, upsertRepo, createPost, recentVoiceExamples } from './db';
import { notifyQueue } from './queue/notify';
import { Platform, Post, PostMode } from './types';

const BLOCKED_NAMES = (process.env.DEVLOG_BLOCKED_NAMES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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

  const mode: PostMode = commit.filesChanged.length > 4 ? 'thread' : 'single';
  const voiceExamples = recentVoiceExamples(db, 5);

  const generated = await generatePost({
    visibility: config.visibility,
    projectName,
    projectTag: config.project_tag,
    commitMessage: redactKnownNames(commit.message, BLOCKED_NAMES),
    diff: diffForModel,
    manualSummary: commit.manualSummary,
    mode,
    voiceExamples,
  });

  const platforms: Platform[] = config.platforms?.length ? config.platforms : ['x'];
  const createdPosts: Post[] = [];

  for (const platform of platforms) {
    const post = createPost(db, {
      repoId: repo.id,
      sourceCommit: commit.hash,
      platform,
      content: Array.isArray(generated) ? generated[0] : generated,
      threadParts: Array.isArray(generated) ? generated : null,
    });
    createdPosts.push(post);
  }

  await notifyQueue(createdPosts, repo);
  return createdPosts;
}
