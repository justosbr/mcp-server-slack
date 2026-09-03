import { describe, it, expect, vi, beforeEach } from "vitest";
const { mockSlackCall } = vi.hoisted(() => ({ mockSlackCall: vi.fn() }));
vi.mock("../../src/slack.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../src/slack.js")>()), slackCall: mockSlackCall }));
import { getThread } from "../../src/tools/get-thread.js";
const env = { botToken: "xoxb-test" };

describe("get_thread", () => {
  beforeEach(() => mockSlackCall.mockReset());
  it("reads replies for a thread", async () => {
    mockSlackCall.mockResolvedValue({ ok: true, messages: [
      { ts: "1725283200.000100", user: "U1", text: "parent", reply_count: 1, thread_ts: "1725283200.000100" },
      { ts: "1725283300.000300", user: "U3", text: "reply", thread_ts: "1725283200.000100" },
    ] });
    const out = await getThread.handler({ channel: "C1", thread_ts: "1725283200.000100" }, env);
    expect(mockSlackCall).toHaveBeenCalledWith(env, "conversations.replies", expect.objectContaining({ channel: "C1", ts: "1725283200.000100", limit: 50 }));
    expect(out.content[0].text).toContain("parent");
    expect(out.content[0].text).toContain("reply");
  });
});
