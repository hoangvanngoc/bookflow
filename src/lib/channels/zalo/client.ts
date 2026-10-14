const SEND_URL = "https://openapi.zalo.me/v3.0/oa/message/cs";

export type SendResult = { ok: boolean; detail: string };

/** Sends customer-service text replies from the Official Account. */
export class ZaloOaClient {
  constructor(
    private readonly accessToken: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async sendText(userId: string, text: string): Promise<SendResult> {
    try {
      const res = await this.fetchImpl(SEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: this.accessToken },
        body: JSON.stringify({ recipient: { user_id: userId }, message: { text } }),
      });
      // Zalo answers HTTP 200 with { error: 0 } on success and a non-zero code otherwise.
      const data = (await res.json().catch(() => ({}))) as { error?: number; message?: string };
      const ok = res.ok && data.error === 0;
      return { ok, detail: ok ? "sent" : `HTTP ${res.status}, error ${data.error ?? "?"}: ${data.message ?? ""}`.trim() };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : "Network error" };
    }
  }
}
