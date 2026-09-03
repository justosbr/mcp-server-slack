import { describe, it, expect, vi } from "vitest";

const { mockSlackCall } = vi.hoisted(() => ({ mockSlackCall: vi.fn() }));
vi.mock("../../src/slack.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../src/slack.js")>();
  return { ...mod, slackCall: mockSlackCall };
});

import { listChannels } from "../../src/tools/list-channels.js";
const env = { botToken: "xoxb-test" };

// Reset is called at the top of each test rather than in beforeEach: a beforeEach-driven
// reset ahead of a mockRejectedValue call makes Vitest 4.1.x report the promise as an
// unhandled rejection even though this file's own try/catch handles it (reproduced down to
// a two-test minimal case across the 4.1.x line; not present with a same-test reset).

describe("list_channels", () => {
  it("requests public channels only and renders them", async () => {
    mockSlackCall.mockReset();
    mockSlackCall.mockResolvedValue({
      ok: true,
      channels: [
        { id: "C1", name: "eng-claims", topic: { value: "Claims engineering" }, purpose: { value: "" }, num_members: 12, is_member: true },
        { id: "C2", name: "random", topic: { value: "" }, purpose: { value: "Anything" }, num_members: 80, is_member: false },
      ],
      response_metadata: { next_cursor: "abc" },
    });
    const out = await listChannels.handler({}, env);
    expect(mockSlackCall).toHaveBeenCalledWith(env, "conversations.list", expect.objectContaining({ types: "public_channel", exclude_archived: true, limit: 100 }));
    const text = out.content[0].text;
    expect(text).toContain("#eng-claims (C1)");
    expect(text).toContain("member: yes");
    expect(text).toContain("#random (C2)");
    expect(text).toContain("member: no");
    expect(text).toContain("Next page cursor: abc");
  });

  it("filters by substring over name, topic, and purpose", async () => {
    mockSlackCall.mockReset();
    mockSlackCall.mockResolvedValue({ ok: true, channels: [
      { id: "C1", name: "eng-claims", topic: { value: "" }, purpose: { value: "" }, num_members: 1, is_member: false },
      { id: "C2", name: "random", topic: { value: "" }, purpose: { value: "claims chatter" }, num_members: 1, is_member: false },
      { id: "C3", name: "design", topic: { value: "" }, purpose: { value: "" }, num_members: 1, is_member: false },
    ] });
    const text = (await listChannels.handler({ query: "CLAIMS" }, env)).content[0].text;
    expect(text).toContain("C1");
    expect(text).toContain("C2");
    expect(text).not.toContain("C3");
  });

  it("returns an error result on Slack failure", async () => {
    mockSlackCall.mockReset();
    const { SlackApiError } = await import("../../src/slack.js");
    mockSlackCall.mockRejectedValue(new SlackApiError("conversations.list", "ratelimited", 429, 3));
    const out = await listChannels.handler({}, env);
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain("rate limit");
  });
});
