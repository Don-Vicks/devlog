import fs from 'fs';
import path from 'path';

const HOOK_TEMPLATE = `#!/bin/sh
# Installed by devlog — do not edit directly, re-run "devlog install" to update.
node "REPLACE_WITH_CLI_PATH" process-commit "$(git rev-parse --show-toplevel)" &
`;

export function installHook(repoPath: string, cliPath: string): string {
  const hooksDir = path.join(repoPath, '.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    throw new Error(`${repoPath} does not look like a git repo (no .git/hooks)`);
  }

  const hookPath = path.join(hooksDir, 'post-commit');
  const content = HOOK_TEMPLATE.replace('REPLACE_WITH_CLI_PATH', cliPath);

  if (fs.existsSync(hookPath)) {
    fs.copyFileSync(hookPath, `${hookPath}.pre-devlog-backup`);
  }

  fs.writeFileSync(hookPath, content, { mode: 0o755 });
  return hookPath;
}
