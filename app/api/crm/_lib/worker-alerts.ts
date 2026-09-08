const LOG_PREFIX = "[WORKER_ALERTS]";

export const sendWorkerSlackAlert = async (input: {
  title: string;
  text: string;
  fields?: Record<string, string | number | null | undefined>;
}): Promise<boolean> => {
  const webhookUrl = process.env.SLACK_ALERTS_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.error(`${LOG_PREFIX} alert_no_webhook`, {
      title: input.title,
      text: input.text,
      fields: input.fields || null,
    });
    return false;
  }

  const fieldLines = Object.entries(input.fields || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `• *${key}:* ${String(value)}`)
    .join("\n");

  const body = {
    text: `*${input.title}*\n${input.text}${fieldLines ? `\n${fieldLines}` : ""}`,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`${LOG_PREFIX} slack_http_error`, {
        status: response.status,
        title: input.title,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} slack_send_failed`, {
      title: input.title,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};
