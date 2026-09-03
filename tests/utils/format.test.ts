import { describe, it, expect } from "vitest";
import { clip, tsToIso, formatMessages, MAX_OUTPUT_BYTES } from "../../src/utils/format.js";

describe("format", () => {
  it("clips long text with an ellipsis", () => {
    expect(clip("a".repeat(600))).toHaveLength(501);
    expect(clip("a".repeat(600)).endsWith("…")).toBe(true);
    expect(clip("short")).toBe("short");
  });
  it("clips by code point, never splitting a surrogate pair", () => {
    // The emoji sits exactly on the UTF-16 boundary a naive slice(0, 500) would cut through
    // (499 ASCII code units + the emoji's high surrogate at index 499).
    const input = "a".repeat(499) + "😀" + "z".repeat(20);
    const out = clip(input, 500);
    expect(out).toContain("😀");
    expect(out.endsWith("…")).toBe(true);
    // No lone (unpaired) surrogate anywhere in the result.
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)).toBe(false);
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
  it("caps total output, measured in UTF-8 bytes", () => {
    const many = Array.from({ length: 2000 }, (_, i) => ({ ts: `${1725283200 + i}.000000`, user: "U1", text: "x".repeat(400) }));
    const out = formatMessages(many);
    expect(Buffer.byteLength(out, "utf8")).toBeLessThanOrEqual(MAX_OUTPUT_BYTES);
    expect(out).toContain("output capped");
  });
});
