import path from 'path';
import fs from 'fs';

/**
 * Find the monorepo root by walking up from a directory looking for .devlog-root.
 * Returns the starting dir if no marker is found.
 */
export function findProjectRoot(from: string): string {
  let dir = from;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.devlog-root'))) return dir;
    dir = path.dirname(dir);
  }
  return from;
}

/**
 * Path to the CLI entry point for the post-commit hook.
 * In packaged mode: Resources/core/cli.js (extraResources copy of core/dist)
 * In dev mode:      packages/core/dist/cli.js
 */
export function getCliPath(isPackaged: boolean, dirname: string, projectRoot: string): string {
  if (isPackaged) {
    return path.join(process.resourcesPath, 'core', 'cli.js');
  }
  return path.join(projectRoot, 'packages', 'core', 'dist', 'cli.js');
}

/**
 * Path to the built dashboard HTML.
 */
export function getDashboardPath(isPackaged: boolean, projectRoot: string): string {
  if (isPackaged) {
    return path.join(process.resourcesPath, 'dashboard', 'index.html');
  }
  return path.join(projectRoot, 'packages', 'dashboard', 'dist', 'index.html');
}
