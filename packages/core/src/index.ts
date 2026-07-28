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
  listAccounts,
  upsertAccount,
  deleteAccount,
  getAccount,
  recentVoiceExamples,
} from './db';
export type { PostWithRepo, UpsertRepoArgs, CreatePostArgs, UpsertAccountArgs } from './db';

export { loadRepoConfig, writeRepoConfig, DEFAULTS as DEFAULT_REPO_CONFIG } from './config/loadConfig';
export { resolveProjectName } from './extraction/projectName';
export { installHook } from './hooks/install';
export { processCommit } from './pipeline';
export { redact, redactKnownNames } from './redaction/redact';
export { readVoiceRules, writeVoiceRules, listVoiceProfiles, createVoiceProfile, deleteVoiceProfile } from './generation/voiceRules';
export { extractSnippet } from './generation/extractSnippet';
export { renderSnippet, cleanupScreenshot } from './generation/renderSnippet';
export { connectXAccount, disconnectXAccount, listXAccounts } from './publish/xAuth';
export { postToX } from './publish/postToX';
export { connectLinkedInAccount, disconnectLinkedInAccount, listLinkedInAccounts } from './publish/linkedinAuth';
export { postToLinkedIn } from './publish/postToLinkedIn';
export { uploadMediaX, uploadMediaLinkedIn } from './publish/uploadMedia';
export { approveAndMaybePublish } from './publish/publish';
export { startBot } from './queue/bot';
