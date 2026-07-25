import fetch from 'node-fetch';

const MODEL = 'llama3.1:8b';

interface OllamaResponse {
  response?: string;
}

export async function generateWithOllama(prompt: string): Promise<string> {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434';

  const res = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${await res.text()}. Is 'ollama serve' running?`);
  }

  const data = (await res.json()) as OllamaResponse;
  if (!data.response) throw new Error('Ollama returned no text');
  return data.response.trim();
}
