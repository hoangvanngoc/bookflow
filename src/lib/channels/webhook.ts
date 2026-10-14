import type { BookingEvent, DeliveryResult, NotificationChannel } from "./types";

/**
 * POSTs the booking as JSON to any URL. This one adapter covers most integrations
 * a small business needs on day one (Zapier, Make, n8n, a Slack incoming webhook
 * relay, the customer's own endpoint). Try it with a URL from https://webhook.site.
 */
export class WebhookChannel implements NotificationChannel {
  readonly id = "webhook";
  readonly label = "Webhook";

  constructor(
    private readonly url: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async send(event: BookingEvent): Promise<DeliveryResult> {
    const at = new Date().toISOString();
    try {
      const res = await this.fetchImpl(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      return { channel: this.id, ok: res.ok, detail: `HTTP ${res.status}`, at };
    } catch (err) {
      return { channel: this.id, ok: false, detail: err instanceof Error ? err.message : "Network error", at };
    }
  }
}
