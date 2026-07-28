import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SCREENSHOTS_DIR = path.join(os.homedir(), '.devlog', 'screenshots');

function ensureDir(): void {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  rb: 'ruby',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  csharp: 'csharp',
  css: 'css',
  html: 'html',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  sh: 'bash',
  bash: 'bash',
  sql: 'sql',
  toml: 'toml',
  graphql: 'graphql',
  sol: 'solidity',
};

function normalizeLanguage(lang: string): string {
  return LANG_MAP[lang.toLowerCase()] || lang.toLowerCase();
}

export function renderSnippet(snippet: string, language: string, postId: number): string | null {
  ensureDir();
  const outputPath = path.join(SCREENSHOTS_DIR, `${postId}.png`);
  const lang = normalizeLanguage(language);

  try {
    const siliconArgs = [
      '--language', lang,
      '--output', outputPath,
      '--theme', 'Dracula',
      '--shadow-color', '#000000',
      '--shadow-blur-radius', '16',
      '--pad-horiz', '40',
      '--pad-vert', '40',
    ];

    execSync(`silicon ${siliconArgs.map((a) => `"${a}"`).join(' ')}`, {
      input: snippet,
      timeout: 10_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
    return null;
  } catch {
    return null;
  }
}

export function cleanupScreenshot(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore cleanup failures
  }
}
