import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';

const DEVLOG_DIR = path.join(os.homedir(), '.devlog');

/**
 * Load environment variables from .env, merging in order:
 *   1. ~/.devlog/.env        (user-level, survives monorepo moves)
 *   2. <monorepo-root>/.env  (project-level, relative to this file)
 *   3. process.cwd()/.env    (legacy fallback)
 *
 * Earlier files take precedence: a key already set (from a higher-priority
 * file or the shell) is never overwritten, but a lower-priority file still
 * fills in keys the others are missing. This way a project `.env` without
 * GROQ_API_KEY doesn't shadow the user-level `~/.devlog/.env`.
 */
export function loadEnv(): void {
  const candidates = [
    path.join(DEVLOG_DIR, '.env'),
    path.resolve(__dirname, '..', '..', '..', '.env'),
    path.join(process.cwd(), '.env'),
  ];

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }
}
