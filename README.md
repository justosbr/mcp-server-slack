# mcp-server-slack

Read-only MCP server for **public** Slack channels, on a bot token. Five tools: list channels, join a public channel, read channel history, read a thread, look up a user. No posting, no reactions, no private channels or DMs.

> This repository is public primarily so Justos team members and internal tooling can install it. External use is welcome under the ISC license but not actively supported.

## Prerequisites

- Node.js 22+
- A Slack app with a **bot token** (`xoxb-…`) carrying exactly these scopes: `channels:read`, `channels:join`, `channels:history`, `users:read`. Do not add `groups:*`, `im:*`, or `mpim:*`: their absence is what keeps private channels and DMs unreadable even if a tool asked.

## Setup

```bash
git clone <repo-url>
cd mcp-server-slack
npm install
npm run build
```

## MCP client configuration

```json
{
  "mcpServers": {
    "slack_readonly": {
      "command": "node",
      "args": ["/path/to/mcp-server-slack/dist/index.js"],
      "env": { "SLACK_BOT_TOKEN": "xoxb-..." }
    }
  }
}
```

## Tools

| Tool | Slack method | Notes |
|---|---|---|
| `list_channels` | `conversations.list` (`types=public_channel`) | id, members, whether the bot is a member, topic/purpose; substring filter; paginated |
| `join_channel` | `conversations.info` + `conversations.join` | the one write: joins a public channel so its history is readable; refuses private/archived |
| `get_channel_history` | `conversations.history` | oldest-first, time window (ISO or Unix), paginated; `not_in_channel` → join hint |
| `get_thread` | `conversations.replies` | parent + replies for a `ts` |
| `get_user` | `users.info` | name, handle, title, tz, is_bot |

Bot tokens cannot read a public channel the bot is not in; that is why `join_channel` exists.

## Output limits

Message text is clipped at 500 characters; a history or thread page is capped at ~25 KB with a visible "output capped" line. Default page size 50, maximum 200.

## Development

```bash
npm test
npm run test:watch
npm run dev
```
