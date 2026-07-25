import { RedactionResult } from '../types';

interface Pattern {
  name: string;
  re: RegExp;
}

const PATTERNS: Pattern[] = [
  { name: 'env_assignment', re: /\b([A-Z0-9_]{3,}(KEY|TOKEN|SECRET|PASSWORD|PWD))\s*[:=]\s*['"]?[A-Za-z0-9_\-/+=.]{8,}['"]?/g },
  { name: 'aws_key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'openai_key', re: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'anthropic_key', re: /sk-ant-[A-Za-z0-9\-_]{20,}/g },
  { name: 'google_key', re: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: 'slack_token', re: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
  { name: 'private_key_block', re: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----/g },
  { name: 'db_connection', re: /(postgres|mysql|mongodb(\+srv)?):\/\/[^\s'"]+/g },
  { name: 'internal_url', re: /https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|[a-z0-9-]+\.internal)[^\s'"]*/gi },
  { name: 'dotenv_line', re: /^[A-Z0-9_]+=.+$/gm },
];

export function redact(text: string | null | undefined): RedactionResult {
  if (!text) {
    return { clean: text ?? '', redactedCount: 0, patternsHit: [] };
  }

  let clean = text;
  const hits: string[] = [];

  for (const { name, re } of PATTERNS) {
    clean = clean.replace(re, () => {
      hits.push(name);
      return '[REDACTED]';
    });
  }

  return { clean, redactedCount: hits.length, patternsHit: [...new Set(hits)] };
}

/**
 * Strips a configurable list of client/company names that should never
 * appear in public posts even when mentioned incidentally.
 */
export function redactKnownNames(text: string, blockedNames: string[] = []): string {
  let clean = text;
  for (const name of blockedNames) {
    if (!name) continue;
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    clean = clean.replace(re, '[CLIENT]');
  }
  return clean;
}
