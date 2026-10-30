/**
 * Pollinations client — the native counterpart of the webapp's provider
 * layer (src/lib/pollinations/* + src/lib/agent/provider-url.ts).
 *
 *   · Models: GET https://gen.pollinations.ai/models — the same live
 *     catalogue the web app proxies through /api/pollinations/models,
 *     normalized with the same rules (free = all-zero rates or rate-less
 *     non-paid; unavailable = health down; free-first ordering).
 *   · Chat: POST https://gen.pollinations.ai/v1/chat/completions with
 *     stream: true — the same endpoint + body shape the web runtime sends
 *     through its chat-proxy (chatCompletionsUrl(base) with base
 *     https://gen.pollinations.ai/v1).
 *
 * Streaming runs on React Native's incremental XHR (onprogress with
 * responseType 'text' delivers partial responseText — the react-native-sse
 * pattern), so deltas render as they arrive without any polyfill.
 */

import type { ModelInfo } from '../types';

const MODELS_URL = 'https://gen.pollinations.ai/models';
const CHAT_URL = 'https://gen.pollinations.ai/v1/chat/completions';

/** The system-prompt identity — the Onyx AI framework prompt from the web
 * app (src/lib/scheduler/chat-context.ts), adjusted for this chat-only
 * surface (no tool-calling lane here — answers are plain markdown). */
export const SYSTEM_PROMPT = [
  "You are OnyxAgent, an AI assistant built with Onyx AI — OnyxAgent's native agent framework.",
  'Follow Onyx AI conventions:',
  '- Structure your responses clearly with markdown',
  '- Be precise and type-safe in your reasoning',
  '- Handle errors gracefully and suggest alternatives',
  '- Keep answers focused and useful',
].join('\n');

// ---------------------------------------------------------------------------
// Live model catalogue
// ---------------------------------------------------------------------------

interface RawModel {
  name?: string;
  title?: string;
  publisher?: string;
  description?: string;
  community?: boolean;
  paid_only?: boolean;
  category?: string;
  input_modalities?: string[];
  output_modalities?: string[];
  context_length?: number;
  pricing?: Record<string, string | number>;
  health?: { status?: string };
}

const num = (v: string | number | undefined | null): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Web isFreeModel: all rates zero, or a rate-less non-paid model. */
function isFreeModel(m: RawModel): boolean {
  const p = m.pricing;
  if (!p) return false;
  const values = Object.entries(p)
    .filter(([k]) => k !== 'currency')
    .map(([, v]) => num(v as string | undefined));
  if (values.length === 0) return m.paid_only !== true;
  return values.every((v) => v === 0);
}

function isUnavailable(m: RawModel): boolean {
  const status = m.health?.status?.toLowerCase();
  return status === 'down' || status === 'unavailable' || status === 'offline';
}

/**
 * Fetch + normalize the live catalogue. Text-output models only, sorted
 * like the web picker: free & healthy first, then healthy, then the rest,
 * unavailable last; ties break alphabetically.
 */
export async function fetchPollinationsModels(timeoutMs = 15000): Promise<ModelInfo[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(MODELS_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`Models request failed (HTTP ${res.status})`);
    const raw = (await res.json()) as RawModel[];
    if (!Array.isArray(raw)) throw new Error('Malformed catalogue response');

    const textOut = (m: RawModel) =>
      (m.output_modalities ?? []).some((s) => s.toLowerCase() === 'text') ||
      (m.category ?? '').toLowerCase() === 'text';

    const models: ModelInfo[] = raw
      .filter((m) => typeof m.name === 'string' && m.name.length > 0 && textOut(m))
      .map((m) => ({
        id: m.name as string,
        title: m.title ?? (m.name as string),
        publisher: m.publisher ?? 'unknown',
        description: m.description ?? '',
        community: m.community === true,
        free: isFreeModel(m),
        healthy: (m.health?.status ?? '').toLowerCase() === 'healthy',
        unavailable: isUnavailable(m),
        contextLength: typeof m.context_length === 'number' ? m.context_length : undefined,
      }));

    models.sort((a, b) => {
      const rank = (m: ModelInfo): number => {
        if (m.unavailable) return 9;
        if (m.free && m.healthy) return 0;
        if (m.free) return 1;
        if (m.healthy) return 2;
        return 3;
      };
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return a.id.localeCompare(b.id);
    });

    return models;
  } finally {
    clearTimeout(timer);
  }
}

/** Pick a sensible default — the web pickDefaultModel ladder: healthy free
 * official → healthy free → healthy → first. */
export function pickDefaultModel(models: ModelInfo[]): string {
  const official = (m: ModelInfo) => !m.community;
  const healthyFree = models.find((m) => official(m) && !m.unavailable && m.free);
  if (healthyFree) return healthyFree.id;
  const anyHealthyFree = models.find((m) => !m.unavailable && m.free);
  if (anyHealthyFree) return anyHealthyFree.id;
  const anyHealthy = models.find((m) => !m.unavailable);
  if (anyHealthy) return anyHealthy.id;
  // The catalogue always aliases "openai" — a safe last resort.
  return 'openai';
}

/** "openai/gpt-5.4-nano" → "gpt-5.4-nano" for compact chips. */
export function shortModelName(id: string): string {
  const idx = id.indexOf('/');
  const short = idx >= 0 ? id.slice(idx + 1) : id;
  return short.length > 22 ? `${short.slice(0, 21)}…` : short;
}

// ---------------------------------------------------------------------------
// Streaming chat (incremental XHR → SSE parse)
// ---------------------------------------------------------------------------

export interface WireMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamResult {
  ok: boolean;
  aborted?: boolean;
  error?: string;
}

export interface StreamHandle {
  abort: () => void;
  done: Promise<StreamResult>;
}

/**
 * POST /v1/chat/completions with stream:true and stream the response.
 *
 * React Native's XHR emits onprogress with the accumulated responseText as
 * it grows (progressive text events) — each event yields only the NEW
 * slice, which is parsed as SSE `data:` lines (OpenAI-compatible
 * chat.completion.chunks, exactly what the web runtime parses).
 */
export function streamChat(opts: {
  model: string;
  messages: WireMessage[];
  apiKey?: string;
  onDelta: (delta: string) => void;
}): StreamHandle {
  const xhr = new XMLHttpRequest();
  let settled = false;
  let lastIndex = 0;
  let sseBuffer = '';
  let sawDone = false;
  let resolveDone: (result: StreamResult) => void;
  const done = new Promise<StreamResult>((resolve) => {
    resolveDone = resolve;
  });

  const settle = (result: StreamResult) => {
    if (settled) return;
    settled = true;
    resolveDone(result);
  };

  const handleSseChunk = (chunk: string) => {
    sseBuffer += chunk;
    // Split into lines; keep the last (possibly partial) line buffered.
    const lines = sseBuffer.split(/\r?\n/);
    sseBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith(':')) continue;
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') {
        sawDone = true;
        settle({ ok: true });
        xhr.abort(); // the stream is finished — release the connection
        return;
      }
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
          error?: { message?: string };
        };
        if (json.error?.message) {
          settle({ ok: false, error: json.error.message });
          xhr.abort();
          return;
        }
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          opts.onDelta(delta);
        }
      } catch {
        // Partial/keep-alive noise — the next chunk completes the line.
      }
    }
  };

  xhr.open('POST', CHAT_URL);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Accept', 'text/event-stream');
  if (opts.apiKey && opts.apiKey.trim().length > 0) {
    xhr.setRequestHeader('Authorization', `Bearer ${opts.apiKey.trim()}`);
  }
  xhr.responseType = 'text';
  xhr.timeout = 120000;

  // Progressive text: RN emits onprogress while the body streams in.
  xhr.onprogress = () => {
    const full = xhr.responseText ?? '';
    if (full.length > lastIndex) {
      handleSseChunk(full.slice(lastIndex));
      lastIndex = full.length;
    }
  };
  xhr.onload = () => {
    // Final flush (covers non-streaming or buffered responses).
    const full = xhr.responseText ?? '';
    if (full.length > lastIndex) {
      handleSseChunk(full.slice(lastIndex));
      lastIndex = full.length;
    }
    if (settled) return;
    if (xhr.status >= 200 && xhr.status < 300) {
      settle({ ok: sawDone || full.length > 0, error: full.length === 0 ? 'Empty response' : undefined });
    } else {
      let message = `Request failed (HTTP ${xhr.status})`;
      try {
        const parsed = JSON.parse(full) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        /* keep default */
      }
      settle({ ok: false, error: message });
    }
  };
  xhr.onerror = () => {
    if (!settled) settle({ ok: false, error: 'Network error — check your connection' });
  };
  xhr.onabort = () => {
    if (!settled) settle({ ok: false, aborted: true });
  };
  xhr.ontimeout = () => {
    if (!settled) settle({ ok: false, error: 'The model took too long to respond' });
  };

  xhr.send(
    JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      stream: true,
    }),
  );

  return {
    abort: () => {
      if (!settled) {
        settled = true;
        resolveDone({ ok: false, aborted: true });
      }
      try {
        xhr.abort();
      } catch {
        /* already gone */
      }
    },
    done,
  };
}
