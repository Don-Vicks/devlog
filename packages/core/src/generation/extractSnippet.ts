import fetch from 'node-fetch';

interface SnippetResult {
  file: string;
  language: string;
  snippet: string;
}

const LANG_OVERRIDES: Record<string, string> = {
  typescriptreact: 'tsx',
  javascriptreact: 'jsx',
  shellscript: 'bash',
  objectivec: 'c',
  'c++': 'cpp',
  'c#': 'csharp',
};

export async function extractSnippet(diff: string, commitMessage: string): Promise<SnippetResult | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const prompt = `You are extracting a code snippet from a git diff for a social media screenshot.

Read the diff below. Find the single most interesting or educational chunk of code — the key logic, the clever fix, the non-obvious decision. 5-15 lines max. Not imports, not boilerplate, not config.

DIFF:
${diff.slice(0, 8000)}

COMMIT: ${commitMessage}

You MUST respond with a single JSON object and nothing else. No explanation, no markdown, no code blocks. Just the raw JSON:
{"file":"path/to/file.ts","language":"typescript","snippet":"the code lines here"}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) return null;

    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as SnippetResult;
        if (parsed.snippet && parsed.language) {
          parsed.language = LANG_OVERRIDES[parsed.language.toLowerCase()] || parsed.language;
          return parsed;
        }
      } catch { /* not valid JSON, try regex */ }
    }

    const jsonMatch = trimmed.match(/\{[^{}]*"snippet"[^{}]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as SnippetResult;
    if (!parsed.snippet || !parsed.language) return null;

    parsed.language = LANG_OVERRIDES[parsed.language.toLowerCase()] || parsed.language;
    return parsed;
  } catch {
    return null;
  }
}
