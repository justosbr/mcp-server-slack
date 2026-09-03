import { describe, it, expect, vi, beforeEach } from "vitest";
const { mockSlackCall } = vi.hoisted(() => ({ mockSlackCall: vi.fn() }));
vi.mock("../../src/slack.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../src/slack.js")>()), slackCall: mockSlackCall }));
import { joinChannel } from "../../src/tools/join-channel.js";
const env = { botToken: "xoxb-test" };

describe("join_channel", () => {
  beforeEach(() => mockSlackCall.mockReset());

  it("joins a public channel", async () => {
    mockSlackCall
      .mockResolvedValueOnce({ ok: true, channel: { id: "C1", name: "eng", is_channel: true, is_private: false, is_archived: false } })
      .mockResolvedValueOnce({ ok: true, channel: { id: "C1", name: "eng" } });
    const out = await joinChannel.handler({ channel: "C1" }, env);
    expect(out.isError).toBeUndefined();
    expect(out.content[0].text).toContain("Joined #eng (C1)");
    expect(mockSlackCall).toHaveBeenNthCalledWith(1, env, "conversations.info", { channel: "C1" });
    expect(mockSlackCall).toHaveBeenNthCalledWith(2, env, "conversations.join", { channel: "C1" }, { post: true });
  });

  it("refuses a private channel without calling join", async () => {
    mockSlackCall.mockResolvedValueOnce({ ok: true, channel: { id: "G1", name: "secret", is_channel: false, is_private: true } });
    const out = await joinChannel.handler({ channel: "C1" }, env);
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain("not a public channel");
    expect(mockSlackCall).toHaveBeenCalledTimes(1);
  });

  it("treats already_in_channel as success", async () => {
    mockSlackCall
      .mockResolvedValueOnce({ ok: true, channel: { id: "C1", name: "eng", is_channel: true, is_private: false, is_archived: false } })
      .mockResolvedValueOnce({ ok: true, warning: "already_in_channel", channel: { id: "C1", name: "eng" } });
    const out = await joinChannel.handler({ channel: "C1" }, env);
    expect(out.isError).toBeUndefined();
    expect(out.content[0].text).toContain("Already a member");
  });
});
