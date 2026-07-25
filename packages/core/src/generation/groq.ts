import fetch from 'node-fetch';

const MODEL = 'llama-3.3-70b-versatile';

interface GroqResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function generateWithGroq(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as GroqResponse;
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned no text');
  return text.trim();
}
