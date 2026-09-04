import { z } from "zod";
import { slackCall } from "../slack.js";
import { ToolDefinition, CURSOR_SCHEMA } from "./types.js";
import { formatError, errorContent } from "../utils/errors.js";
import { clip } from "../utils/format.js";
import type { SlackEnv } from "../config.js";

/** Bounds on the server-side walk a `query` triggers. 200 is Slack's maximum page size for
 *  conversations.list, so a workspace of up to SEARCH_PAGE_SIZE × MAX_SEARCH_PAGES channels is
 *  covered by one call. A larger workspace is searched as far as the cap allows and the reply
 *  says so, carrying the cursor to continue from. */
const SEARCH_PAGE_SIZE = 200;
const MAX_SEARCH_PAGES = 10;

const schema = {
  query: z.string().max(200).optional().describe("Case-insensitive substring matched against channel name, topic, and purpose. Searches the whole workspace, not one page"),
  limit: z.number().int().min(1).max(200).default(100).describe("Channels per page (1-200) when listing without a query. Default 100. A query is searched at Slack's maximum page size regardless"),
  cursor: CURSOR_SCHEMA,
};

interface Channel {
  id: string; name: string; num_members?: number; is_member?: boolean;
  topic?: { value?: string }; purpose?: { value?: string };
}

interface ChannelPage {
  channels: Channel[];
  response_metadata?: { next_cursor?: string };
}

interface Scan {
  /** Every match on the pages walked. The rendered list and the ground the cursor resumes
   *  after cover the same pages, so a continuation cannot step over a match. */
  matches: Channel[];
  scanned: number;
  /** Set only when the page cap stopped the walk with pages still unread, so the caller can
   *  resume from here; absent means the walk reached the end of the list. */
  nextCursor?: string;
}

function listPage(env: SlackEnv, limit: number, cursor?: string): Promise<ChannelPage> {
  return slackCall<ChannelPage>(
    env, "conversations.list", { types: "public_channel", exclude_archived: true, limit, cursor },
  );
}

function isMatch(channel: Channel, query: string): boolean {
  return [channel.name, channel.topic?.value ?? "", channel.purpose?.value ?? ""]
    .some((field) => field.toLowerCase().includes(query));
}

function render(channels: Channel[]): string {
  return channels.map((c) => {
    const about = [c.topic?.value, c.purpose?.value].filter(Boolean).map((s) => clip(s!, 120)).join(" | ");
    return `- #${c.name} (${c.id}) members: ${c.num_members ?? "?"}, member: ${c.is_member ? "yes" : "no"}${about ? ` — ${about}` : ""}`;
  }).join("\n");
}

/** Walks conversations.list from `startCursor`, keeping the channels that match, until Slack
 *  reports no further page or the page cap is reached. A caller who asks by name wants the
 *  channel wherever it sits in the workspace, so the paging is the tool's to drive. */
async function scan(env: SlackEnv, query: string, startCursor?: string): Promise<Scan> {
  const matches: Channel[] = [];
  let cursor = startCursor;
  let scanned = 0;
  for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
    const body = await listPage(env, SEARCH_PAGE_SIZE, cursor);
    const channels = body.channels ?? [];
    scanned += channels.length;
    for (const channel of channels) if (isMatch(channel, query)) matches.push(channel);
    // Slack sends an empty string, not a missing field, on the last page.
    cursor = body.response_metadata?.next_cursor || undefined;
    if (!cursor) return { matches, scanned };
  }
  return { matches, scanned, nextCursor: cursor };
}

function count(n: number): string {
  return `${n} public channel${n === 1 ? "" : "s"}`;
}

/** States what the walk covered. `scanned` counts only the channels after the start cursor, so
 *  a resumed walk is described relative to that cursor: "all" and "the first" are claims only a
 *  walk from the start of the list can make. */
function coverageText(result: Scan, resumed: boolean): string {
  if (resumed) {
    return result.nextCursor
      ? `searched ${count(result.scanned)} from the supplied cursor (search cap reached)`
      : `searched ${count(result.scanned)} from the supplied cursor to the end of the list`;
  }
  return result.nextCursor
    ? `searched the first ${count(result.scanned)} (search cap reached)`
    : `searched all ${count(result.scanned)}`;
}

function searchText(query: string, result: Scan, resumed: boolean): string {
  const coverage = coverageText(result, resumed);
  if (result.matches.length === 0) {
    const resume = result.nextCursor ? ` Continue the search with cursor: ${result.nextCursor}` : "";
    return `No public channels matching "${query}" — ${coverage}.${resume}`;
  }
  const resume = result.nextCursor ? `\n\nNext page cursor: ${result.nextCursor}` : "";
  return `${count(result.matches.length)} matching "${query}" — ${coverage}:\n\n${render(result.matches)}${resume}`;
}

async function handler(params: Record<string, unknown>, env: SlackEnv) {
  const query = params.query as string | undefined;
  const limit = (params.limit as number) ?? 100;
  const cursor = params.cursor as string | undefined;
  try {
    if (query) {
      const result = await scan(env, query.toLowerCase(), cursor);
      return { content: [{ type: "text" as const, text: searchText(query, result, Boolean(cursor)) }] };
    }
    const page = await listPage(env, limit, cursor);
    const channels = page.channels ?? [];
    if (channels.length === 0) {
      return { content: [{ type: "text" as const, text: "No public channels on this page." }] };
    }
    let text = `${channels.length} public channels:\n\n${render(channels)}`;
    const next = page.response_metadata?.next_cursor;
    if (next) text += `\n\nNext page cursor: ${next}`;
    return { content: [{ type: "text" as const, text }] };
  } catch (error) {
    return errorContent(formatError(error, "list_channels"));
  }
}

export const listChannels: ToolDefinition = {
  name: "list_channels",
  description:
    "List public Slack channels (never private channels or DMs) with id, member count, whether the bot is a member, topic and purpose. Pass query to find a channel by name, topic, or purpose: one call searches the whole workspace (up to 2000 channels) and returns every match it finds, so there is no need to page through the list looking for a name. Without a query the list comes back one page of `limit` channels at a time. Use the id with the other tools; if member is 'no', call join_channel before reading history.",
  schema,
  handler,
};
