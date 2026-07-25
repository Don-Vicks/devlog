import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const MEDIA_DIR = path.join(os.homedir(), '.devlog', 'media');

const EXT_MAP: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  rust: 'rs',
  python: 'py',
  json: 'json',
};

function extFor(lang: string): string {
  return EXT_MAP[lang] || 'txt';
}

/**
 * Generates a styled code-card image from a snippet using carbon-now-cli.
 * Requires: npm install -g carbon-now-cli
 */
export function generateCodeCard(snippet: string, lang = 'typescript', filenamePrefix = 'code'): string | null {
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

  const tmpFile = path.join(os.tmpdir(), `devlog-snippet-${Date.now()}.${extFor(lang)}`);
  fs.writeFileSync(tmpFile, snippet);

  const outName = `${filenamePrefix}-${Date.now()}`;
  const outPath = path.join(MEDIA_DIR, `${outName}.png`);

  try {
    execSync(
      `carbon-now ${tmpFile} --save-to ${MEDIA_DIR} --save-as ${outName} --headless`,
      { stdio: 'pipe' }
    );
    return outPath;
  } catch (err) {
    console.warn('[devlog] carbon-now-cli not available or failed:', (err as Error).message);
    return null;
  } finally {
    fs.unlinkSync(tmpFile);
  }
}
