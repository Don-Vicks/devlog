import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { RepoConfig, ResolvedName } from '../types';

function safeRead(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function fromConfig(config: RepoConfig | null | undefined): string | null {
  return config?.project_name ?? null;
}

function fromPackageJson(repoPath: string): string | null {
  const raw = safeRead(path.join(repoPath, 'package.json'));
  if (!raw) return null;
  try {
    const pkg = JSON.parse(raw) as { name?: string };
    return pkg.name || null;
  } catch {
    return null;
  }
}

function fromReadme(repoPath: string): string | null {
  const candidates = ['README.md', 'Readme.md', 'readme.md'];
  for (const name of candidates) {
    const raw = safeRead(path.join(repoPath, name));
    if (!raw) continue;
    const match = raw.match(/^#\s+(.+)$/m);
    if (match) return match[1].trim();
  }
  return null;
}

function fromGitRemote(repoPath: string): string | null {
  try {
    const url = execSync('git remote get-url origin', { cwd: repoPath }).toString().trim();
    const match = url.match(/\/([^/]+?)(\.git)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function fromFolder(repoPath: string): string {
  return path.basename(repoPath);
}

/**
 * Resolve the human-facing project name for a repo.
 * Priority: .devlog.yml override > package.json > README heading > git remote > folder name
 */
export function resolveProjectName(repoPath: string, config?: RepoConfig | null): ResolvedName {
  const strategies: Array<[ResolvedName['source'], () => string | null]> = [
    ['config', () => fromConfig(config)],
    ['package_json', () => fromPackageJson(repoPath)],
    ['readme', () => fromReadme(repoPath)],
    ['git_remote', () => fromGitRemote(repoPath)],
    ['folder', () => fromFolder(repoPath)],
  ];

  for (const [source, fn] of strategies) {
    const name = fn();
    if (name) return { name, source };
  }
  return { name: 'unknown-project', source: 'folder' };
}
