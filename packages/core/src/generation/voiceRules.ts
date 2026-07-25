import fs from 'fs';
import path from 'path';

// voice/ lives at the package root, one level up from dist/ or src/generation/
const VOICE_RULES_PATH = path.join(__dirname, '..', '..', 'voice', 'voice-rules.md');

export function readVoiceRules(): string {
  try {
    return fs.readFileSync(VOICE_RULES_PATH, 'utf8');
  } catch {
    return '(no voice-rules.md found — using neutral defaults)';
  }
}

export function writeVoiceRules(content: string): void {
  fs.writeFileSync(VOICE_RULES_PATH, content, 'utf8');
}
