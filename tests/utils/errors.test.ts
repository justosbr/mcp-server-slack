import { describe, it, expect } from "vitest";
import { formatError } from "../../src/utils/errors.js";
import { SlackApiError } from "../../src/slack.js";

describe("formatError", () => {
  it("turns not_in_channel into a join hint", () => {
    const msg = formatError(new SlackApiError("conversations.history", "not_in_channel", 200), "get_channel_history");
    expect(msg).toContain("not a member");
    expect(msg).toContain("join_channel");
  });
  it("reports rate limits with the wait", () => {
    const msg = formatError(new SlackApiError("conversations.list", "ratelimited", 429, 12), "list_channels");
    expect(msg).toContain("rate limit");
    expect(msg).toContain("12");
  });
  it("names missing scopes", () => {
    const msg = formatError(new SlackApiError("conversations.history", "missing_scope", 200), "get_channel_history");
    expect(msg).toContain("missing_scope");
    expect(msg).toContain("get_channel_history");
  });
  it("falls back for plain errors", () => {
    expect(formatError(new Error("boom"), "get_user")).toBe("Error in get_user: boom");
  });
});
