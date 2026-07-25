import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { RepoConfig } from '../types';

const DEFAULTS: RepoConfig = {
  project_name: null,
  visibility: 'public',
  project_tag: null,
  voice_profile: 'default',
  platforms: ['x'],
};

export function loadRepoConfig(repoPath: string): RepoConfig {
  const configPath = path.join(repoPath, '.devlog.yml');
  if (!fs.existsSync(configPath)) return { ...DEFAULTS };

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = (yaml.load(raw) as Partial<RepoConfig>) || {};
    return { ...DEFAULTS, ...parsed };
  } catch (err) {
    console.warn(`[devlog] Failed to parse .devlog.yml at ${configPath}: ${(err as Error).message}`);
    return { ...DEFAULTS };
  }
}

/**
 * Writes/overwrites a repo's .devlog.yml. Used by the dashboard's "add repo"
 * and "edit repo settings" flows so Victor never has to hand-edit YAML.
 */
export function writeRepoConfig(repoPath: string, config: Partial<RepoConfig>): void {
  const configPath = path.join(repoPath, '.devlog.yml');
  const merged: RepoConfig = { ...loadRepoConfig(repoPath), ...config };
  const yamlStr = yaml.dump(merged, { lineWidth: -1 });
  fs.writeFileSync(configPath, yamlStr, 'utf8');
}

export { DEFAULTS };
