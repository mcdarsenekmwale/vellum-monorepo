/**
 * React Native / Expo SSE parser — NO EventSource polyfill needed.
 * Uses fetch + ReadableStream + TextDecoder (polyfilled by Expo on iOS/Android).
 * 100% pure JS — no native modules, no EventSource.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiBaseUrl } from '../config/env';

export type AiPlacement = 'web-profile' | 'mobile-nav' | 'admin-fab' | 'admin-quick-action';

export interface ChatMessageLite {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface ChatRequest {
  conversationId?: string;
  placement: AiPlacement;
  messages: ChatMessageLite[];
  confirmedToolCalls?: Array<{ id: string; name: string; arguments: Record<string, any> }>;
  quickActionName?: string;
}

export type SSEEventTypes = 'meta' | 'chunk' | 'tool_call' | 'error' | 'done';

export interface SSEOutput {
  meta: null | {
    conversationId: string;
    model: string;
    persona: AiPlacement;
    placement: AiPlacement;
  };
  chunks: string[];
  toolCalls: any[];
  done: null | {
    usage: { inputTokens: number; outputTokens: number };
    durationMs: number;
  };
  error: null | { code: string; message: string; retryAfter?: number };
}

// Detect web at runtime so we can use localStorage fallback for SecureStore
const isWeb =
  Platform.OS === 'web' ||
  (typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined' &&
    typeof window.document !== 'undefined');

/** Retrieve the bearer token from the same SecureStore key apiClient uses. */
export async function getBearerToken(): Promise<string | null> {
  try {
    if (isWeb) {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem('vellbase_access_token');
    }
    return await SecureStore.getItemAsync('vellbase_access_token');
  } catch {
    return null;
  }
}

/** Best-guess TextDecoder instance; Expo RN typically ships one globally. */
let _decoder: TextDecoder | null = null;
function getDecoder(): TextDecoder | null {
  if (_decoder !== null) return _decoder;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    if (typeof g.TextDecoder === 'function') {
      _decoder = new g.TextDecoder('utf-8');
    }
  } catch {
    _decoder = null;
  }
  return _decoder;
}

/** Minimal UTF-8 byte → string fallback for environments missing TextDecoder. */
function fallbackDecode(bytes: Uint8Array): string {
  // Only handle ASCII correctly (good-enough for JSON text deltas in SSE).
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function decodeBytes(bytes: Uint8Array): string {
  const dec = getDecoder();
  if (dec) {
    try {
      return dec.decode(bytes, { stream: true });
    } catch {
      // fall through
    }
  }
  return fallbackDecode(bytes);
}

function apiUrl(path: string): string {
  const base = (apiBaseUrl || '').replace(/\/$/, '');
  if (base) return base + path;
  // Last-ditch fallback (shouldn't hit because config/env.ts always returns one).
  return Platform.OS === 'android' ? 'http://10.0.2.2:3001' + path : 'http://127.0.0.1:3001' + path;
}

export async function runAIChat(params: {
  req: ChatRequest;
  bearerToken?: string | null;
  onChunk?: (delta: string) => void;
  /** Optional abort signal. When truthy, reading stops as soon as possible. */
  aborted?: { current: boolean };
}): Promise<SSEOutput> {
  const out: SSEOutput = {
    meta: null,
    chunks: [],
    toolCalls: [],
    done: null,
    error: null,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (params.bearerToken) headers.Authorization = `Bearer ${params.bearerToken}`;

  try {
    const resp = await fetch(apiUrl('/api/ai/chat'), {
      method: 'POST',
      headers,
      body: JSON.stringify(params.req),
    });

    if (!resp.ok) {
      let text = '';
      try {
        text = await resp.text();
      } catch {
        /* ignore */
      }
      out.error = {
        code: `HTTP_${resp.status}`,
        message: text.slice(0, 400) || 'Request failed',
      };
      return out;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = (resp as any).body;
    const reader: ReadableStreamDefaultReader<Uint8Array> | undefined = body?.getReader?.();
    if (!reader) {
      out.error = {
        code: 'NO_READABLE_STREAM',
        message: 'Streaming body unavailable on this platform.',
      };
      return out;
    }

    let buffer = '';

    while (true) {
      if (params.aborted?.current) {
        try {
          reader.releaseLock();
        } catch {
          /* ignore */
        }
        break;
      }

      let value: Uint8Array | undefined;
      let done = false;
      try {
        const result = await reader.read();
        value = result.value as Uint8Array | undefined;
        done = result.done;
      } catch (readErr) {
        out.error = {
          code: 'STREAM_READ_ERROR',
          message: String((readErr as Error)?.message || readErr),
        };
        break;
      }

      if (done) break;
      if (value) buffer += decodeBytes(value);

      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        processFrame(frame, out, params.onChunk);
      }
    }

    // Flush any remaining buffer that didn't end with \n\n
    if (buffer.length > 0) {
      processFrame(buffer, out, params.onChunk);
    }
  } catch (err) {
    out.error = {
      code: 'FETCH_ERROR',
      message: String((err as Error)?.message || err),
    };
  }

  return out;
}

function processFrame(
  frame: string,
  out: SSEOutput,
  onChunk?: (delta: string) => void,
): void {
  // SSE frames can contain multiple lines; find event: and data: lines.
  const eventMatch = frame.match(/^event:\s*([a-z_]+)/im);
  const dataMatch = frame.match(/^data:\s*(.+)/ims);
  if (!eventMatch || !dataMatch) return;

  const event = eventMatch[1] as SSEEventTypes;
  const rawData = dataMatch[1].trim();

  if (event === 'chunk' && rawData.startsWith('{')) {
    // chunk payloads are JSON-encoded `{delta}` objects
    try {
      const parsed = JSON.parse(rawData);
      const delta: string = typeof parsed === 'string' ? parsed : parsed?.delta ?? '';
      if (delta) {
        out.chunks.push(delta);
        onChunk?.(delta);
      }
      return;
    } catch {
      // fall through to treat as raw string
    }
  }

  if (event === 'chunk') {
    // Plain string chunk (unusual but safe to handle)
    const delta = rawData;
    if (delta) {
      out.chunks.push(delta);
      onChunk?.(delta);
    }
    return;
  }

  // Other events: parse JSON bodies
  let parsed: any = rawData;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    parsed = rawData;
  }

  switch (event) {
    case 'meta':
      out.meta = parsed;
      break;
    case 'tool_call':
      out.toolCalls.push(parsed);
      break;
    case 'error':
      out.error = parsed;
      break;
    case 'done':
      out.done = parsed;
      break;
  }
}
