import { execSync } from 'child_process';
import { CommitInfo, CommitPayload, Visibility } from '../types';

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, maxBuffer: 1024 * 1024 * 20 }).toString();
}

export function getLastCommitInfo(repoPath: string): CommitInfo {
  const message = run('git log -1 --pretty=%B', repoPath).trim();
  const hash = run('git log -1 --pretty=%H', repoPath).trim();
  const filesChanged = run('git show --stat --oneline HEAD', repoPath)
    .split('\n')
    .filter((l) => l.includes('|'))
    .map((l) => l.split('|')[0].trim());
  return { hash, message, filesChanged };
}

export function getLastCommitDiff(repoPath: string): string {
  return run('git show HEAD --unified=3', repoPath);
}

/**
 * Extraction respects repo visibility:
 * - public: full diff + message + files
 * - private/client: file names + commit message ONLY. No diff content.
 *   Victor supplies a short manual summary via commit message convention:
 *   "fix: payment webhook retry logic [[summary: fixed webhook retries]]"
 */
export function extractCommitPayload(repoPath: string, visibility: Visibility): CommitPayload {
  const info = getLastCommitInfo(repoPath);

  if (visibility === 'public') {
    return {
      ...info,
      diff: getLastCommitDiff(repoPath),
      manualSummary: null,
    };
  }

  // private / client — no code content ever leaves this function
  const summaryMatch = info.message.match(/\[\[summary:\s*(.+?)\]\]/i);
  return {
    ...info,
    diff: null,
    manualSummary: summaryMatch ? summaryMatch[1].trim() : null,
  };
}
