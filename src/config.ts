export interface SlackEnv {
  botToken: string;
}

/** The bot token the server authenticates with. Only a bot token (xoxb-) is accepted:
 *  a user token would make every read run as a person, which this server is not for. */
export function validateEnv(): SlackEnv {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    throw new Error("SLACK_BOT_TOKEN environment variable is required (a Slack bot token, xoxb-...)");
  }
  if (!botToken.startsWith("xoxb-")) {
    throw new Error("SLACK_BOT_TOKEN must be a bot token (xoxb-...), not a user or app token");
  }
  return { botToken };
}
