import { generateWithGemini } from './gemini';
import { generateWithGroq } from './groq';
import { generateWithOllama } from './ollama';
import { redact } from '../redaction/redact';
import { readVoiceRules } from './voiceRules';
import { GeneratePostArgs, Platform, VoiceExample } from '../types';

function formatExamples(voiceExamples: VoiceExample[], platform: Platform): string {
  if (voiceExamples.length === 0) return '';
  return voiceExamples.map((ex, i) => `Example ${i + 1}:\n${ex.edited_content}`).join('\n\n');
}

function getPlatformInstructions(platform: Platform, mode: string): string {
  if (platform === 'linkedin') {
    return `Write a LinkedIn post — longer, more conversational. 3-5 short paragraphs.
Structure: what was built (specifics) → what was hard/surprising → one takeaway.
Include personal context — time spent, what you'd tell someone starting the same thing.
No hashtag stuffing. One project tag max if configured.
No filler closers.`;
  }

  // X (Twitter)
  if (mode === 'thread') {
    return `Write a 3-4 part X (Twitter) thread. Each part must stand alone if read out of order.
Part 1: What I set out to do — the problem or goal, stated plainly.
Part 2: The technical approach — what I built, how, why this specific way. Mention real tools and patterns.
Part 3: What went wrong or what surprised me — the bug, the API quirk, the unexpected win.
Part 4: What I learned or would do differently — a takeaway someone else can use.
Return each tweet separated by a line containing only "---".
Keep each part under 280 characters.`;
  }

  return `Write a single X (Twitter) post. Under 280 characters.
Structure: hook (what was built) → 1-2 lines of technical depth → one-liner takeaway.
Lead with the thing itself, not "here's what I built." No hashtags unless project tag is configured.`;
}

export function buildPrompt(args: GeneratePostArgs): string {
  const { projectName, projectTag, commitMessage, diff, manualSummary, mode, platform, voiceProfile, voiceExamples, engagementNotes } = args;

  const voiceRules = readVoiceRules(voiceProfile);
  const examples = formatExamples(voiceExamples, platform);
  const platformInstructions = getPlatformInstructions(platform, mode);

  const sourceContent = diff
    ? `Commit message: ${commitMessage}\n\nDiff:\n${diff.slice(0, 6000)}`
    : `Commit message: ${commitMessage}\n\nManual summary (no code available — private repo): ${manualSummary || '(none provided)'}`;

  return `You are writing a daily build log entry for a developer. Not an announcement. Not a product update. A raw, honest log of what they just built.

VOICE RULES:
${voiceRules}

PAST POSTS THIS DEVELOPER ACTUALLY APPROVED (match this style closely):
${examples || '(no examples yet — use the voice rules above as the primary guide)'}

${engagementNotes ? `WHAT HAS WORKED WELL RECENTLY:\n${engagementNotes}\n` : ''}

PROJECT: ${projectName}${projectTag ? ` (tag: ${projectTag})` : ''}

SOURCE ACTIVITY:
${sourceContent}

YOUR TASK:
Read the diff carefully. Find the most interesting or non-obvious thing about this change — the technical decision, the bug that was solved, the approach that wasn't obvious. Don't just restate the commit message. Tell the story of what was actually built.

${platformInstructions}

Return ONLY the post content, nothing else — no preamble, no explanation, no markdown formatting.`;
}

/**
 * Routes generation based on repo visibility:
 * - private/client -> local Ollama only, nothing leaves the machine
 * - public -> Groq primary (free tier, 30 req/min), Gemini fallback if key is set
 * Returns a single string for 'single' mode, or string[] for 'thread' mode.
 */
export async function generatePost(args: GeneratePostArgs): Promise<string | string[]> {
  const prompt = buildPrompt(args);

  let rawOutput: string;
  if (args.visibility === 'private' || args.visibility === 'client') {
    rawOutput = await generateWithOllama(prompt);
  } else if (process.env.GEMINI_API_KEY) {
    try {
      rawOutput = await generateWithGemini(prompt);
    } catch (err) {
      console.warn(`[devlog] Gemini failed (${(err as Error).message}), falling back to Groq`);
      rawOutput = await generateWithGroq(prompt);
    }
  } else {
    rawOutput = await generateWithGroq(prompt);
  }

  const { clean } = redact(rawOutput);

  if (args.mode === 'thread') {
    return clean.split('---').map((s) => s.trim()).filter(Boolean);
  }
  return clean;
}
