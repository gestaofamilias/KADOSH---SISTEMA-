export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export interface OllamaRunningModel {
  name: string;
  size: number;
  size_vram: number;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkConnection(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listModels(baseUrl: string): Promise<OllamaModel[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: any) => ({
      name: m.name || m.model,
      size: m.size,
      modified_at: m.modified_at,
    }));
  } catch {
    return [];
  }
}

export async function listRunningModels(baseUrl: string): Promise<OllamaRunningModel[]> {
  try {
    const res = await fetch(`${baseUrl}/api/ps`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: any) => ({
      name: m.name || m.model,
      size: m.size,
      size_vram: m.size_vram,
    }));
  } catch {
    return [];
  }
}

export function pickDefaultModel(models: OllamaModel[]): string | null {
  if (models.length === 0) return null;
  const preferred = models.find(m => m.name.startsWith("deepseek-r1:8b"));
  return preferred ? preferred.name : models[0].name;
}

export async function generate(baseUrl: string, model: string, prompt: string, options: { json?: boolean } = {}): Promise<string> {
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      // Thinking-capable models (e.g. qwen3) emit an empty response when forced into
      // grammar-constrained "format: json" mode before they get to reason. Disabling
      // thinking instead lets them answer directly while still respecting the prompt's
      // JSON instructions.
      ...(options.json ? { think: false } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama respondeu com status ${res.status}`);
  }
  const data = await res.json();
  return data.response || "";
}

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatStream(
  baseUrl: string,
  model: string,
  messages: OllamaChatMessage[],
  onToken: (token: string) => void
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true, think: false }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama respondeu com status ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line);
        const content = chunk?.message?.content;
        if (content) onToken(content);
      } catch {
        // ignore malformed partial line
      }
    }
  }

  if (buffer.trim()) {
    try {
      const chunk = JSON.parse(buffer);
      const content = chunk?.message?.content;
      if (content) onToken(content);
    } catch {
      // ignore trailing malformed chunk
    }
  }
}
