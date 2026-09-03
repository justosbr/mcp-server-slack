import { describe, it, expect, vi } from "vitest";
const { mockSlackCall } = vi.hoisted(() => ({ mockSlackCall: vi.fn() }));
vi.mock("../../src/slack.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../src/slack.js")>()), slackCall: mockSlackCall }));
import { getChannelHistory } from "../../src/tools/get-channel-history.js";
import { SlackApiError } from "../../src/slack.js";
const env = { botToken: "xoxb-test" };

// Reset is called at the top of each test rather than in beforeEach: see the note in
// list-channels.test.ts (a beforeEach-driven reset ahead of a mockRejectedValue call makes
// Vitest 4.1.x report the promise as an unhandled rejection despite this file's own catch).

describe("get_channel_history", () => {
  it("reads history, converting ISO bounds to unix seconds, oldest first", async () => {
    mockSlackCall.mockReset();
    mockSlackCall.mockResolvedValue({ ok: true, messages: [
      { ts: "1725283260.000200", user: "U2", text: "second" },
      { ts: "1725283200.000100", user: "U1", text: "first" },
    ], has_more: true, response_metadata: { next_cursor: "cur" } });
    const out = await getChannelHistory.handler({ channel: "C1", oldest: "2024-09-02T13:00:00Z", limit: 50 }, env);
    expect(mockSlackCall).toHaveBeenCalledWith(env, "conversations.history", expect.objectContaining({ channel: "C1", oldest: "1725282000", limit: 50 }));
    const text = out.content[0].text;
    expect(text.indexOf("first")).toBeLessThan(text.indexOf("second"));
    expect(text).toContain("Next page cursor: cur");
  });

  it("maps not_in_channel to the join hint", async () => {
    mockSlackCall.mockReset();
    mockSlackCall.mockRejectedValue(new SlackApiError("conversations.history", "not_in_channel", 200));
    const out = await getChannelHistory.handler({ channel: "C1" }, env);
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain("join_channel");
  });
});
