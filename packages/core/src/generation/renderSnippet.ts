import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';

const SCREENSHOTS_DIR = path.join(os.homedir(), '.devlog', 'screenshots');

function ensureDir(): void {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

interface Token {
  text: string;
  type: 'keyword' | 'string' | 'comment' | 'number' | 'function' | 'type' | 'plain';
}

const KEYWORDS_JS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'new', 'this', 'class', 'extends',
  'import', 'export', 'from', 'default', 'async', 'await', 'try', 'catch',
  'throw', 'finally', 'typeof', 'instanceof', 'in', 'of', 'true', 'false', 'null',
  'undefined', 'void', 'delete', 'yield', 'static', 'super', 'with', 'debugger',
]);

const KEYWORDS_PY = new Set([
  'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'break',
  'continue', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise',
  'with', 'yield', 'lambda', 'pass', 'True', 'False', 'None', 'and', 'or',
  'not', 'is', 'in', 'global', 'nonlocal', 'assert', 'del', 'print',
]);

const KEYWORDS_RS = new Set([
  'fn', 'let', 'mut', 'const', 'return', 'if', 'else', 'for', 'while', 'loop',
  'match', 'pub', 'use', 'mod', 'struct', 'enum', 'impl', 'trait', 'type',
  'where', 'self', 'Self', 'super', 'crate', 'async', 'await', 'move',
  'ref', 'true', 'false', 'as', 'in', 'dyn', 'static', 'unsafe', 'extern',
]);

const KEYWORDS_GO = new Set([
  'func', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'default',
  'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go',
  'defer', 'select', 'package', 'import', 'true', 'false', 'nil', 'make',
  'new', 'len', 'cap', 'append', 'error', 'string', 'int', 'bool',
]);

const TYPESCRIPT_TYPES = new Set([
  'string', 'number', 'boolean', 'void', 'null', 'undefined', 'any',
  'unknown', 'never', 'object', 'symbol', 'bigint', 'Array', 'Promise',
  'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Exclude',
  'Extract', 'ReturnType', 'Parameters',
]);

function getKeywords(lang: string): Set<string> {
  const l = lang.toLowerCase();
  if (l === 'python' || l === 'py') return KEYWORDS_PY;
  if (l === 'rust' || l === 'rs') return KEYWORDS_RS;
  if (l === 'go') return KEYWORDS_GO;
  return KEYWORDS_JS;
}

function tokenize(code: string, lang: string): Token[] {
  const tokens: Token[] = [];
  const keywords = getKeywords(lang);
  const l = lang.toLowerCase();
  const isTS = l === 'typescript' || l === 'ts' || l === 'tsx' || l === 'typescriptreact';

  let i = 0;
  while (i < code.length) {
    if (code[i] === '/' && code[i + 1] === '/') {
      let end = code.indexOf('\n', i);
      if (end === -1) end = code.length;
      tokens.push({ text: code.slice(i, end), type: 'comment' });
      i = end;
      continue;
    }
    if (code[i] === '/' && code[i + 1] === '*') {
      let end = code.indexOf('*/', i + 2);
      if (end === -1) end = code.length; else end += 2;
      tokens.push({ text: code.slice(i, end), type: 'comment' });
      i = end;
      continue;
    }
    if (code[i] === '#' && (l === 'python' || l === 'py' || l === 'rust' || l === 'rs')) {
      let end = code.indexOf('\n', i);
      if (end === -1) end = code.length;
      tokens.push({ text: code.slice(i, end), type: 'comment' });
      i = end;
      continue;
    }
    if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
      const quote = code[i];
      let end = i + 1;
      while (end < code.length && code[end] !== quote) {
        if (code[end] === '\\') end++;
        end++;
      }
      end = Math.min(end + 1, code.length);
      tokens.push({ text: code.slice(i, end), type: 'string' });
      i = end;
      continue;
    }
    if (/[0-9]/.test(code[i])) {
      let end = i;
      while (end < code.length && /[0-9.xXa-fA-F_]/.test(code[end])) end++;
      tokens.push({ text: code.slice(i, end), type: 'number' });
      i = end;
      continue;
    }
    if (/[a-zA-Z_$]/.test(code[i])) {
      let end = i;
      while (end < code.length && /[a-zA-Z0-9_$]/.test(code[end])) end++;
      const word = code.slice(i, end);
      if (keywords.has(word)) {
        tokens.push({ text: word, type: 'keyword' });
      } else if (isTS && TYPESCRIPT_TYPES.has(word)) {
        tokens.push({ text: word, type: 'type' });
      } else if (end < code.length && code[end] === '(') {
        tokens.push({ text: word, type: 'function' });
      } else {
        tokens.push({ text: word, type: 'plain' });
      }
      i = end;
      continue;
    }
    tokens.push({ text: code[i], type: 'plain' });
    i++;
  }
  return tokens;
}

const TOKEN_COLORS: Record<Token['type'], string> = {
  keyword: '#FF79C6',
  string: '#F1FA8C',
  comment: '#6272A4',
  number: '#BD93F9',
  function: '#50FA7B',
  type: '#8BE9FD',
  plain: '#F8F8F2',
};

const FONT_SIZE = 13;
const LINE_HEIGHT = 24;
const LINE_NUM_WIDTH = 48;
const CODE_PAD_LEFT = 16;
const CARD_PAD_X = 24;
const CARD_PAD_TOP = 20;
const CARD_PAD_BOTTOM = 16;
const TITLEBAR_H = 40;
const FOOTER_H = 36;

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildSvg(snippet: string, lang: string, fileName: string): string {
  const codeLines = snippet.split('\n');
  const lineCount = codeLines.length;
  const lineNumDigits = String(lineCount).length;

  const maxLen = codeLines.reduce((max, l) => Math.max(max, l.length), 0);
  const codeWidth = Math.max(400, Math.min(680, maxLen * 8 + 60));
  const totalW = LINE_NUM_WIDTH + CODE_PAD_LEFT + codeWidth + CARD_PAD_X * 2;
  const codeH = lineCount * LINE_HEIGHT;
  const totalH = TITLEBAR_H + CARD_PAD_TOP + codeH + CARD_PAD_BOTTOM + FOOTER_H + CARD_PAD_X;

  const lineNumW = lineNumDigits * 9 + 12;

  let codeSvg = '';
  for (let i = 0; i < lineCount; i++) {
    const y = TITLEBAR_H + CARD_PAD_TOP + (i + 1) * LINE_HEIGHT - 6;
    const num = String(i + 1).padStart(lineNumDigits, ' ');
    codeSvg += `<text x="${CARD_PAD_X + lineNumW}" y="${y}" fill="rgba(255,255,255,0.15)" font-size="12" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" text-anchor="end">${escapeXml(num)}</text>\n`;

    const tokens = tokenize(codeLines[i], lang);
    let x = CARD_PAD_X + lineNumW + 14;
    for (const t of tokens) {
      const color = TOKEN_COLORS[t.type];
      const escaped = escapeXml(t.text);
      codeSvg += `<text x="${x}" y="${y}" fill="${color}" font-size="${FONT_SIZE}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace">${escaped}</text>\n`;
      x += t.text.length * 8;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0a0a1a"/>
    <stop offset="40%" stop-color="#12102a"/>
    <stop offset="70%" stop-color="#1a1040"/>
    <stop offset="100%" stop-color="#0d0d24"/>
  </linearGradient>
  <linearGradient id="cardBg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="rgba(255,255,255,0.04)"/>
    <stop offset="100%" stop-color="rgba(255,255,255,0.01)"/>
  </linearGradient>
</defs>
<rect width="${totalW}" height="${totalH}" fill="url(#bg)" rx="16"/>
<rect x="8" y="8" width="${totalW - 16}" height="${totalH - 16}" rx="12" fill="url(#cardBg)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
<circle cx="28" cy="28" r="5.5" fill="#FF5F56"/>
<circle cx="46" cy="28" r="5.5" fill="#FFBD2E"/>
<circle cx="64" cy="28" r="5.5" fill="#27C93F"/>
<text x="${totalW / 2}" y="32" fill="rgba(255,255,255,0.25)" font-size="11" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" text-anchor="middle" letter-spacing="0.5">${escapeXml(fileName)}</text>
<line x1="16" y1="${TITLEBAR_H}" x2="${totalW - 16}" y2="${TITLEBAR_H}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
${codeSvg}
<line x1="16" y1="${totalH - FOOTER_H}" x2="${totalW - 16}" y2="${totalH - FOOTER_H}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
<text x="${totalW - 20}" y="${totalH - 14}" fill="rgba(255,255,255,0.12)" font-size="10" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" text-anchor="end" letter-spacing="1.5">DEVLOG</text>
</svg>`;
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rs: 'rust', go: 'go', rb: 'ruby', java: 'java',
  c: 'c', cpp: 'cpp', csharp: 'csharp', css: 'css', html: 'html',
  json: 'json', yaml: 'yaml', yml: 'yaml', sh: 'bash', bash: 'bash',
  sql: 'sql', toml: 'toml', graphql: 'graphql', sol: 'solidity',
};

function normalizeLanguage(lang: string): string {
  return LANG_MAP[lang.toLowerCase()] || lang.toLowerCase();
}

export async function renderSnippet(
  snippet: string,
  language: string,
  postId: number,
  fileName?: string
): Promise<string | null> {
  ensureDir();
  const outputPath = path.join(SCREENSHOTS_DIR, `${postId}.png`);
  const lang = normalizeLanguage(language);
  const ext = lang === 'typescript' ? 'ts' : lang === 'javascript' ? 'js' : lang === 'python' ? 'py' : lang;
  const name = fileName || `snippet.${ext}`;

  try {
    const svg = buildSvg(snippet, lang, name);
    const svgBuffer = Buffer.from(svg, 'utf8');
    await sharp(svgBuffer).png().toFile(outputPath);

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
  } catch {}
}
