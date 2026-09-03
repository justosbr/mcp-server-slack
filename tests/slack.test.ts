import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { slackCall, SlackApiError } from "../src/slack.js";

const env = { botToken: "xoxb-test" };

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

describe("slackCall", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("GETs with bearer auth and query params, dropping undefined", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, channels: [] }));
    const out = await slackCall(env, "conversations.list", { types: "public_channel", limit: 100, cursor: undefined });
    expect(out).toEqual({ ok: true, channels: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://slack.com/api/conversations.list?types=public_channel&limit=100");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer xoxb-test");
  });

  it("POSTs JSON when asked", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await slackCall(env, "conversations.join", { channel: "C1" }, { post: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://slack.com/api/conversations.join");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json; charset=utf-8");
    expect(JSON.parse(init.body)).toEqual({ channel: "C1" });
  });

  it("throws SlackApiError on ok:false", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false, error: "not_in_channel" }));
    await expect(slackCall(env, "conversations.history", { channel: "C1" })).rejects.toMatchObject({
      name: "SlackApiError", method: "conversations.history", code: "not_in_channel", status: 200,
    });
  });

  it("throws ratelimited with retryAfterSeconds on 429", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 429, headers: { "Retry-After": "7" } }));
    await expect(slackCall(env, "conversations.list", {})).rejects.toMatchObject({ code: "ratelimited", status: 429, retryAfterSeconds: 7 });
  });
});
