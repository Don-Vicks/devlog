// Public API surface for @devlog/core.
// The Electron app and any other consumer should import from here rather
// than reaching into internal file paths — this is the stable contract.

export * from './types';

export {
  getDb,
  upsertRepo,
  listRepos,
  createPost,
  listPending,
  listAllPosts,
  setPostStatus,
  recentVoiceExamples,
} from './db';
export type { PostWithRepo, UpsertRepoArgs, CreatePostArgs } from './db';

export { loadRepoConfig, writeRepoConfig, DEFAULTS as DEFAULT_REPO_CONFIG } from './config/loadConfig';
export { resolveProjectName } from './extraction/projectName';
export { installHook } from './hooks/install';
export { processCommit } from './pipeline';
export { redact, redactKnownNames } from './redaction/redact';
export { readVoiceRules, writeVoiceRules } from './generation/voiceRules';
