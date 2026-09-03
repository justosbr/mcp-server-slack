import type { ToolResult } from "../tools/types.js";

export const MAX_TEXT_CHARS = 500;
export const MAX_OUTPUT_BYTES = 25_000;

const TRUNCATION_MARKER = "\n…[truncated]";

export interface SlackMessage {
  ts: string;
  user?: string;
  bot_id?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
  subtype?: string;
}

/** Clips to at most `max` Unicode code points, never splitting a surrogate pair (an emoji
 *  counts as one code point, not two UTF-16 units), and appends an ellipsis when anything
 *  was cut. */
export function clip(text: string, max = MAX_TEXT_CHARS): string {
  const codePoints = Array.from(text);
  return codePoints.length > max ? codePoints.slice(0, max).join("") + "…" : text;
}

export function tsToIso(ts: string): string {
  const seconds = Number(ts.split(".")[0]);
  return new Date(seconds * 1000).toISOString();
}

/** One line per message, oldest first as given, with the raw `ts` kept so a thread can be
 *  opened from it. The whole list is capped, measured in UTF-8 bytes, so one call cannot
 *  flood the model's context; the capped-output notice is only added when it itself still
 *  fits the budget, so this never emits more than MAX_OUTPUT_BYTES on its own. A tool's full
 *  result (this text plus any header or pagination line) is bounded again by `boundResult`
 *  at the point the result is returned, which is what guarantees the final cap. */
export function formatMessages(messages: SlackMessage[]): string {
  const lines: string[] = [];
  let bytes = 0;
  for (const m of messages) {
    const who = m.user ? `<${m.user}>` : m.bot_id ? `<bot:${m.bot_id}>` : "<unknown>";
    const thread = m.reply_count ? ` (thread, ${m.reply_count} replies)` : "";
    const sub = m.subtype ? ` [${m.subtype}]` : "";
    const line = `- [${tsToIso(m.ts)}] ts=${m.ts} ${who}${sub}: ${clip((m.text ?? "").replace(/\s+/g, " "))}${thread}`;
    const lineBytes = Buffer.byteLength(line, "utf8") + 1;
    if (bytes + lineBytes > MAX_OUTPUT_BYTES) {
      const notice = `… output capped at ~${Math.round(MAX_OUTPUT_BYTES / 1000)}KB (${lines.length} of ${messages.length} shown); narrow the time window or lower limit.`;
      const noticeBytes = Buffer.byteLength(notice, "utf8") + 1;
      if (bytes + noticeBytes <= MAX_OUTPUT_BYTES) lines.push(notice);
      break;
    }
    lines.push(line);
    bytes += lineBytes;
  }
  return lines.join("\n");
}

/** Bounds arbitrary text to `maxBytes` measured in UTF-8 bytes, cutting on a Unicode code
 *  point boundary (never splitting one) and appending a marker that itself fits inside the
 *  cap. This is the single place a tool's complete result text is bounded — see
 *  `boundToolResult` — so no tool needs to reason about headers, pagination cursors, or
 *  echoed input pushing its own per-list cap over the edge. */
export function boundResult(text: string, maxBytes = MAX_OUTPUT_BYTES): string {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  const markerBytes = Buffer.byteLength(TRUNCATION_MARKER, "utf8");
  const budget = Math.max(0, maxBytes - markerBytes);
  const codePoints = Array.from(text);
  let bytes = 0;
  let end = 0;
  for (; end < codePoints.length; end++) {
    const cpBytes = Buffer.byteLength(codePoints[end], "utf8");
    if (bytes + cpBytes > budget) break;
    bytes += cpBytes;
  }
  return codePoints.slice(0, end).join("") + TRUNCATION_MARKER;
}

/** Runs every text content item of a tool result through `boundResult`. This is the choke
 *  point applied once per call in src/index.ts's tool-registration loop, rather than each
 *  tool bounding its own output. */
export function boundToolResult(result: ToolResult): ToolResult {
  return {
    ...result,
    content: result.content.map((item) => ({ ...item, text: boundResult(item.text) })),
  };
}
