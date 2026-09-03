import type { SlackEnv } from "./config.js";

const BASE = "https://slack.com/api/";
const REQUEST_TIMEOUT_MS = 30_000;

export class SlackApiError extends Error {
  name = "SlackApiError";
  constructor(
    public method: string,
    public code: string,
    public status: number,
    public retryAfterSeconds?: number,
  ) {
    super(`Slack ${method} failed: ${code}`);
  }
}

type Params = Record<string, string | number | boolean | undefined>;

/** One Slack Web API call. Slack signals most failures as HTTP 200 with `ok:false`, so the
 *  body is what decides success; HTTP 429 carries Retry-After and is surfaced as `ratelimited`. */
export async function slackCall<T = any>(
  env: SlackEnv,
  method: string,
  params: Params,
  opts: { post?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${env.botToken}` };
  let url = BASE + method;
  let init: RequestInit;
  const defined = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  if (opts.post) {
    headers["Content-Type"] = "application/json; charset=utf-8";
    init = { method: "POST", headers, body: JSON.stringify(defined) };
  } else {
    const qs = new URLSearchParams(Object.entries(defined).map(([k, v]) => [k, String(v)]));
    const q = qs.toString();
    if (q) url += `?${q}`;
    init = { method: "GET", headers };
  }
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (response.status === 429) {
    const header = response.headers.get("Retry-After");
    const parsed = header !== null ? Number(header) : NaN;
    const retryAfterSeconds = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    throw new SlackApiError(method, "ratelimited", 429, retryAfterSeconds);
  }
  if (!response.ok) {
    throw new SlackApiError(method, `http_${response.status}`, response.status);
  }
  const body = (await response.json()) as { ok: boolean; error?: string } & T;
  if (!body.ok) {
    throw new SlackApiError(method, body.error ?? "unknown_error", response.status);
  }
  return body;
}
