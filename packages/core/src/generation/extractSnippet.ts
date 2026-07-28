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

  const prompt = `Read this git diff. Pick the 5-15 most interesting or educational lines of code — the key logic, the clever fix, the non-obvious decision, the core algorithm. Not boilerplate, not imports, not config. The part a fellow builder would want to see.

DIFF:
${diff.slice(0, 8000)}

COMMIT MESSAGE: ${commitMessage}

Return ONLY valid JSON with this shape, nothing else:
{"file": "path/to/file.ts", "language": "typescript", "snippet": "the code here"}`;

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

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as SnippetResult;
    if (!parsed.snippet || !parsed.language) return null;

    parsed.language = LANG_OVERRIDES[parsed.language.toLowerCase()] || parsed.language;
    return parsed;
  } catch {
    return null;
  }
}
