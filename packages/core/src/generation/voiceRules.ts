import fs from 'fs';
import path from 'path';

// voice/ lives at the package root, one level up from dist/ or src/generation/
const VOICE_DIR = path.join(__dirname, '..', '..', 'voice');
const PROFILES_DIR = path.join(VOICE_DIR, 'profiles');
const LEGACY_FILE = path.join(VOICE_DIR, 'voice-rules.md');

const DEFAULT_PROFILE = 'default';

const DEFAULT_TEMPLATE = `# Voice Rules — Default

This is a daily build log. Not an announcement. Not a product update. A raw, honest log of what was built, what went wrong, and what was learned.

## Voice

- Write like you're talking to another builder, not performing for an audience.
- First person. Casual but specific. No corporate energy.
- You don't need to sound impressive — the work speaks for itself.
- If something was annoying, say so. If something was clever, say so. Honesty is the brand.

## What to include

- **What was built** — specific tools, patterns, libraries, code decisions.
- **What was hard** — the bug that took an hour, the API that doesn't work the way the docs say.
- **What surprised you** — something you learned, something easier than expected.
- **One takeaway** — a lesson, an opinion, a thing you'd tell your past self.

## Structure

### Single post (X)
- Hook: what was built, stated plainly.
- 1-2 lines of technical depth — the interesting part.
- Personal honesty — what was hard, what surprised.
- One-liner takeaway. No filler closing.

### Thread (X)
- Each part stands alone if read out of order.
- Part 1: What I set out to do.
- Part 2: The technical approach — what I built, how, why this way.
- Part 3: What went wrong or what surprised me.
- Part 4: What I learned / what I'd do differently.

### LinkedIn
- Longer, more conversational. 3-5 short paragraphs.
- Same structure as single post but can breathe more.
- Include personal context — time spent, frustration, what you'd tell someone starting the same thing.
- No hashtag stuffing. One project tag max if configured.

## Formatting

- No emoji unless the project is explicitly playful.
- No hashtag stuffing — one project tag max, only if configured.
- No "stay tuned" or "more to come" closers.
- Short sentences. Plain language over jargon where possible, but don't dumb down real technical detail.

## Banned phrases

- "Excited to announce"
- "Thrilled to share"
- "Game-changer"
- "Stay tuned"
- "Just shipped" openers
- "Here's what I built" (lazy opener — lead with the thing itself)
- "In the world of" or any framing device that adds nothing

## Notes

This file gets better the more real approved/edited posts get added as
few-shot examples automatically (see voice_examples table) — treat this
doc as the starting point, not the final word.`;

function ensureProfilesDir(): void {
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }
  // Migrate legacy single file to profiles/default.md if profiles dir is empty
  const existing = fs.readdirSync(PROFILES_DIR).filter((f) => f.endsWith('.md'));
  if (existing.length === 0 && fs.existsSync(LEGACY_FILE)) {
    fs.copyFileSync(LEGACY_FILE, path.join(PROFILES_DIR, `${DEFAULT_PROFILE}.md`));
  }
  // Always ensure default.md exists
  const defaultPath = path.join(PROFILES_DIR, `${DEFAULT_PROFILE}.md`);
  if (!fs.existsSync(defaultPath)) {
    fs.writeFileSync(defaultPath, DEFAULT_TEMPLATE, 'utf8');
  }
}

export function listVoiceProfiles(): string[] {
  ensureProfilesDir();
  return fs
    .readdirSync(PROFILES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .sort();
}

export function readVoiceRules(profile?: string): string {
  ensureProfilesDir();
  const name = profile || DEFAULT_PROFILE;
  const filePath = path.join(PROFILES_DIR, `${name}.md`);
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    // Fall back to default if the named profile doesn't exist
    if (name !== DEFAULT_PROFILE) {
      try {
        return fs.readFileSync(path.join(PROFILES_DIR, `${DEFAULT_PROFILE}.md`), 'utf8');
      } catch {
        return '(no voice profiles found — using neutral defaults)';
      }
    }
    return '(no voice-rules.md found — using neutral defaults)';
  }
}

export function writeVoiceRules(content: string, profile?: string): void {
  ensureProfilesDir();
  const name = profile || DEFAULT_PROFILE;
  const filePath = path.join(PROFILES_DIR, `${name}.md`);
  fs.writeFileSync(filePath, content, 'utf8');
}

export function createVoiceProfile(name: string, templateContent?: string): string {
  ensureProfilesDir();
  const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  if (!sanitizedName) throw new Error('Profile name must contain alphanumeric characters');
  if (sanitizedName === DEFAULT_PROFILE) throw new Error(`Cannot create profile named "${DEFAULT_PROFILE}" — it already exists`);
  const filePath = path.join(PROFILES_DIR, `${sanitizedName}.md`);
  if (fs.existsSync(filePath)) throw new Error(`Profile "${sanitizedName}" already exists`);
  const content = templateContent || `# Voice Rules — ${sanitizedName}\n\nEdit this profile to define a distinct writing voice.\n`;
  fs.writeFileSync(filePath, content, 'utf8');
  return sanitizedName;
}

export function deleteVoiceProfile(name: string): void {
  ensureProfilesDir();
  if (name === DEFAULT_PROFILE) throw new Error(`Cannot delete the "${DEFAULT_PROFILE}" profile`);
  const filePath = path.join(PROFILES_DIR, `${name}.md`);
  if (!fs.existsSync(filePath)) throw new Error(`Profile "${name}" not found`);
  fs.unlinkSync(filePath);
}
