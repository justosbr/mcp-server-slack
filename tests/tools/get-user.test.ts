import { describe, it, expect, vi, beforeEach } from "vitest";
const { mockSlackCall } = vi.hoisted(() => ({ mockSlackCall: vi.fn() }));
vi.mock("../../src/slack.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../src/slack.js")>()), slackCall: mockSlackCall }));
import { getUser } from "../../src/tools/get-user.js";
const env = { botToken: "xoxb-test" };

describe("get_user", () => {
  beforeEach(() => mockSlackCall.mockReset());
  it("renders the user", async () => {
    mockSlackCall.mockResolvedValue({ ok: true, user: { id: "U1", name: "juani", real_name: "Juan Castro", tz: "America/Sao_Paulo", is_bot: false, deleted: false, profile: { display_name: "juani", title: "Cloud" } } });
    const text = (await getUser.handler({ user: "U1" }, env)).content[0].text;
    expect(mockSlackCall).toHaveBeenCalledWith(env, "users.info", { user: "U1" });
    expect(text).toContain("U1");
    expect(text).toContain("Juan Castro");
    expect(text).toContain("Cloud");
    expect(text).toContain("America/Sao_Paulo");
  });
});
