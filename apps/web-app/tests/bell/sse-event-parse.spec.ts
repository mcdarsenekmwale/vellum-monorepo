import { describe, it, expect } from 'vitest';

/**
 * SSE frame parser. Browser EventSource's onmessage already strips the
 * framing, but in tests/tooling we sometimes get raw SSE byte buffers.
 * This parser takes the raw SSE text and returns structured frames:
 *
 *   event: activity
 *   data: {"foo":"bar"}
 *
 *   → [{ eventName: 'activity', dataStr: '{"foo":"bar"}', dataObj: {foo:'bar'} }]
 *
 * Frames separated by blank line (\n\n). Comments (: prefix) ignored.
 */
export interface ParsedSseFrame {
  eventName: string | null;
  dataStr: string;
  dataObj: unknown | null;
}

export function parseEventFrames(buffer: string): ParsedSseFrame[] {
  const frames = buffer.split(/\n\n+/);
  const out: ParsedSseFrame[] = [];
  for (const frame of frames) {
    if (!frame.trim()) continue;
    let eventName: string | null = null;
    const dataLines: string[] = [];
    for (const line of frame.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const field = line.slice(0, colon).trim();
      // Note: standard allows 1 space after colon as value separator trim
      const value = line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') eventName = value;
      else if (field === 'data') dataLines.push(value);
    }
    const dataStr = dataLines.join('\n');
    let dataObj: unknown | null = null;
    if (dataStr) {
      try {
        dataObj = JSON.parse(dataStr);
      } catch {
        dataObj = null;
      }
    }
    out.push({ eventName, dataStr, dataObj });
  }
  return out;
}

describe('parseEventFrames SSE line buffer parser', () => {
  it('recognizes "event: hello" frame without data', () => {
    const out = parseEventFrames('event: hello\n\n');
    expect(out.length).toBe(1);
    expect(out[0].eventName).toBe('hello');
  });

  it('parses event activity + data {} → dataObj is {} object type', () => {
    const buf = 'event: activity\ndata:{}\n\n';
    const out = parseEventFrames(buf);
    expect(out.length).toBe(1);
    expect(out[0].eventName).toBe('activity');
    expect(typeof out[0].dataObj).toBe('object');
    expect(out[0].dataObj).not.toBeNull();
    expect(Array.isArray(out[0].dataObj)).toBe(false);
    expect(out[0].dataObj).toEqual({});
  });

  it('multi-frame split by \\n\\n yields 2 parsed frames', () => {
    const buf =
      'event: hello\ndata:{"unread":3}\n\n' +
      'event: activity\ndata:{"id":"x","kind":"LIKE"}\n\n';
    const out = parseEventFrames(buf);
    expect(out.length).toBe(2);
    expect(out[0].eventName).toBe('hello');
    expect((out[0].dataObj as any).unread).toBe(3);
    expect(out[1].eventName).toBe('activity');
    expect((out[1].dataObj as any).kind).toBe('LIKE');
  });
});
