import { describe, it, expect } from "vitest";
import { clip, tsToIso, formatMessages, MAX_OUTPUT_CHARS } from "../../src/utils/format.js";

describe("format", () => {
  it("clips long text with an ellipsis", () => {
    expect(clip("a".repeat(600))).toHaveLength(501);
    expect(clip("a".repeat(600)).endsWith("…")).toBe(true);
    expect(clip("short")).toBe("short");
  });
  it("converts a Slack ts to ISO", () => {
    expect(tsToIso("1725283200.000100")).toBe("2024-09-02T13:20:00.000Z");
  });
  it("renders one line per message with thread info", () => {
    const out = formatMessages([
      { ts: "1725283200.000100", user: "U1", text: "hello", reply_count: 2, thread_ts: "1725283200.000100" },
      { ts: "1725283260.000200", bot_id: "B9", text: "bot says" },
    ]);
    expect(out).toContain("[2024-09-02T13:20:00.000Z] ts=1725283200.000100 <U1>: hello (thread, 2 replies)");
    expect(out).toContain("<bot:B9>: bot says");
  });
  it("caps total output", () => {
    const many = Array.from({ length: 2000 }, (_, i) => ({ ts: `${1725283200 + i}.000000`, user: "U1", text: "x".repeat(400) }));
    const out = formatMessages(many);
    expect(out.length).toBeLessThanOrEqual(MAX_OUTPUT_CHARS + 200);
    expect(out).toContain("output capped");
  });
});
