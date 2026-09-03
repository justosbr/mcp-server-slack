export const MAX_TEXT_CHARS = 500;
export const MAX_OUTPUT_CHARS = 25_000;

export interface SlackMessage {
  ts: string;
  user?: string;
  bot_id?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
  subtype?: string;
}

export function clip(text: string, max = MAX_TEXT_CHARS): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function tsToIso(ts: string): string {
  const seconds = Number(ts.split(".")[0]);
  return new Date(seconds * 1000).toISOString();
}

/** One line per message, oldest first as given, with the raw `ts` kept so a thread can be
 *  opened from it. The whole list is capped so one call cannot flood the model's context. */
export function formatMessages(messages: SlackMessage[]): string {
  const lines: string[] = [];
  let size = 0;
  for (const m of messages) {
    const who = m.user ? `<${m.user}>` : m.bot_id ? `<bot:${m.bot_id}>` : "<unknown>";
    const thread = m.reply_count ? ` (thread, ${m.reply_count} replies)` : "";
    const sub = m.subtype ? ` [${m.subtype}]` : "";
    const line = `- [${tsToIso(m.ts)}] ts=${m.ts} ${who}${sub}: ${clip((m.text ?? "").replace(/\s+/g, " "))}${thread}`;
    if (size + line.length + 1 > MAX_OUTPUT_CHARS) {
      lines.push(`… output capped at ~${Math.round(MAX_OUTPUT_CHARS / 1000)}KB (${lines.length} of ${messages.length} shown); narrow the time window or lower limit.`);
      break;
    }
    lines.push(line);
    size += line.length + 1;
  }
  return lines.join("\n");
}
