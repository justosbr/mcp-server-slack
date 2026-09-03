import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateEnv } from "../src/config.js";

describe("validateEnv", () => {
  const saved = process.env.SLACK_BOT_TOKEN;
  beforeEach(() => {
    delete process.env.SLACK_BOT_TOKEN;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.SLACK_BOT_TOKEN;
    else process.env.SLACK_BOT_TOKEN = saved;
  });

  it("returns the bot token", () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-123-abc";
    expect(validateEnv()).toEqual({ botToken: "xoxb-123-abc" });
  });

  it("fails when unset", () => {
    expect(() => validateEnv()).toThrow(/SLACK_BOT_TOKEN/);
  });

  it("refuses a non-bot token", () => {
    process.env.SLACK_BOT_TOKEN = "xoxp-user-token";
    expect(() => validateEnv()).toThrow(/bot token/);
  });
});
