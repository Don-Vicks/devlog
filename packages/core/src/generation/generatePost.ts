import { generateWithGemini } from './gemini';
import { generateWithGroq } from './groq';
import { generateWithOllama } from './ollama';
import { redact } from '../redaction/redact';
import { readVoiceRules } from './voiceRules';
import { GeneratePostArgs, VoiceExample } from '../types';

function formatExamples(voiceExamples: VoiceExample[]): string {
  return voiceExamples.map((ex, i) => `Example ${i + 1}:\n${ex.edited_content}`).join('\n\n');
}

export function buildPrompt(args: GeneratePostArgs): string {
  const { projectName, projectTag, commitMessage, diff, manualSummary, mode, voiceExamples, engagementNotes } = args;

  const voiceRules = readVoiceRules();
  const examples = formatExamples(voiceExamples);

  const sourceContent = diff
    ? `Commit message: ${commitMessage}\n\nDiff:\n${diff.slice(0, 6000)}`
    : `Commit message: ${commitMessage}\n\nManual summary (no code available — private repo): ${manualSummary || '(none provided)'}`;

  return `You are drafting a build-in-public social post for a developer, in their own voice.

VOICE RULES:
${voiceRules}

PAST POSTS THIS DEVELOPER ACTUALLY APPROVED (match this style closely):
${examples || '(no examples yet — use the voice rules above as the primary guide)'}

${engagementNotes ? `WHAT HAS WORKED WELL RECENTLY:\n${engagementNotes}\n` : ''}

PROJECT: ${projectName}${projectTag ? ` (tag: ${projectTag})` : ''}

SOURCE ACTIVITY:
${sourceContent}

TASK:
${
  mode === 'thread'
    ? 'Write a 3-4 part X (Twitter) thread following a problem -> attempt -> bug -> fix arc. Return each tweet separated by a line containing only "---".'
    : 'Write a single X (Twitter) post (under 280 characters where possible). No hashtags unless the project tag is given. No hype language like "excited to announce".'
}

Return ONLY the post content, nothing else — no preamble, no explanation, no markdown formatting.`;
}

/**
 * Routes generation based on repo visibility:
 * - private/client -> local Ollama only, nothing leaves the machine
 * - public -> Gemini Flash primary, Groq fallback
 * Returns a single string for 'single' mode, or string[] for 'thread' mode.
 */
export async function generatePost(args: GeneratePostArgs): Promise<string | string[]> {
  const prompt = buildPrompt(args);

  let rawOutput: string;
  if (args.visibility === 'private' || args.visibility === 'client') {
    rawOutput = await generateWithOllama(prompt);
  } else {
    try {
      rawOutput = await generateWithGemini(prompt);
    } catch (err) {
      console.warn(`[devlog] Gemini failed (${(err as Error).message}), falling back to Groq`);
      rawOutput = await generateWithGroq(prompt);
    }
  }

  const { clean } = redact(rawOutput);

  if (args.mode === 'thread') {
    return clean.split('---').map((s) => s.trim()).filter(Boolean);
  }
  return clean;
}
