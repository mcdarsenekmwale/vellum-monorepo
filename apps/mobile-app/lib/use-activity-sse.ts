/**
 * React Native / Expo Activity Feed SSE parser — NO EventSource polyfill needed.
 * Uses fetch + ReadableStream + TextDecoder (polyfilled by Expo on iOS/Android).
 * Structure copied VERBATIM from aiSseClient.ts (Sub-project B Task 8 bb6d68d).
 * 100% pure JS — no native modules, no EventSource.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiBaseUrl } from '../config/env';

export type ActivitySseEvent =
  | { type: 'activity'; id: string; kind: string }
  | { type: 'unread'; unread: number }
  | { type: 'hello'; unread: number }
  | { type: 'ping' };

export type ActivitySseOptions = {
  apiBaseUrl?: string;
  tokenStorageKey?: string;
  onEvent?: (ev: ActivitySseEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
};

// Detect web at runtime so we can use localStorage fallback for SecureStore
const isWeb =
  Platform.OS === 'web' ||
  (typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined' &&
    typeof window.document !== 'undefined');

/** Retrieve the bearer token from the same SecureStore key apiClient uses. */
async function getBearerToken(storageKey: string): Promise<string> {
  try {
    if (isWeb) {
      if (typeof window === 'undefined') return '';
      return window.localStorage.getItem(storageKey) || '';
    }
    return (await SecureStore.getItemAsync(storageKey)) || '';
  } catch {
    return '';
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
  let out = '';
  let i = 0;
  const len = bytes.length;
  while (i < len) {
    const b = bytes[i++];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (b < 0xf0) {
      const c1 = bytes[i++];
      const c2 = bytes[i++];
      out += String.fromCharCode(((b & 0x0f) << 12) | ((c1 & 0x3f) << 6) | (c2 & 0x3f));
    } else {
      const c1 = bytes[i++];
      const c2 = bytes[i++];
      const c3 = bytes[i++];
      const cp =
        ((b & 0x07) << 18) | ((c1 & 0x3f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f);
      const off = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (off >> 10), 0xdc00 + (off & 0x3ff));
    }
  }
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

function resolveApiBase(override?: string): string {
  const base = (override || apiBaseUrl || '').replace(/\/$/, '');
  if (base) return base;
  return Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://127.0.0.1:3001';
}

export async function openActivitySseStream(
  opts: ActivitySseOptions,
): Promise<{ close: () => void }> {
  const storageKey = opts.tokenStorageKey ?? 'vellbase_access_token';
  const token = await getBearerToken(storageKey);
  const base = resolveApiBase(opts.apiBaseUrl);
  const url = `${base}/api/activity/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  let closed = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  function close() {
    if (closed) return;
    closed = true;
    try {
      reader?.cancel?.().catch(() => {});
    } catch {
      /* ignore */
    }
    opts.onClose?.();
  }

  function emitFrame(frame: string) {
    // Parse frame line-by-line: event: <name>\n + data: <json>
    let event = 'message';
    let data = '';
    for (const rawLine of frame.split('\n')) {
      const line = rawLine;
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data = line.slice(5).trimStart();
      }
    }
    if (!data) return;
    try {
      const payload = JSON.parse(data);
      if (event === 'activity') {
        opts.onEvent?.({
          type: 'activity',
          id: String(payload.id ?? ''),
          kind: String(payload.kind ?? ''),
        });
      } else if (event === 'unread') {
        opts.onEvent?.({ type: 'unread', unread: Number(payload.unread) || 0 });
      } else if (event === 'hello') {
        opts.onEvent?.({ type: 'hello', unread: Number(payload.unread) || 0 });
      } else if (event === 'ping') {
        opts.onEvent?.({ type: 'ping' });
      }
    } catch {
      /* ignore malformed payload */
    }
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
  if (!res.ok || !(res as any).body) {
    throw new Error(`SSE HTTP ${res.status}`);
  }
  opts.onOpen?.();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = (res as any).body;
  const r: ReadableStreamDefaultReader<Uint8Array> | undefined = body?.getReader?.();
  if (!r) {
    throw new Error('STREAM_READER_UNAVAILABLE');
  }
  reader = r;

  let buffer = '';

  (async () => {
    try {
      while (!closed) {
        let value: Uint8Array | undefined;
        let done = false;
        try {
          const result = await reader!.read();
          value = result.value as Uint8Array | undefined;
          done = result.done;
        } catch (readErr: any) {
          if (!closed) opts.onError?.(readErr instanceof Error ? readErr : new Error(String(readErr)));
          break;
        }
        if (done) break;
        if (value) buffer += decodeBytes(value);

        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          emitFrame(frame);
        }
      }
    } catch (e: any) {
      if (!closed) opts.onError?.(e instanceof Error ? e : new Error(String(e)));
    } finally {
      close();
    }
  })();

  return { close };
}
