import type { Vertical } from "@/verticals";
import { handleMessage, newSession, renderText, type ChatSession } from "../../conversation/engine";
import type { Booking, BookingDraft } from "../../types";
import type { SendResult } from "./client";
import { verifySignature } from "./signature";
import type { ZaloConfig, ZaloWebhookEvent } from "./types";

/**
 * Everything the webhook needs from the outside world. The Worker example wires
 * these to KV and the Zalo client; tests wire them to in-memory fakes.
 */
export type ZaloDeps = {
  config: ZaloConfig;
  vertical: Vertical;
  loadSession(userId: string): Promise<ChatSession | null>;
  saveSession(userId: string, session: ChatSession): Promise<void>;
  listBookings(): Promise<Booking[]>;
  saveBooking(draft: BookingDraft): Promise<Booking>;
  send(userId: string, text: string): Promise<SendResult>;
  now?: () => Date;
};

export type WebhookOutcome = { status: number; body: string };

/**
 * Handles one webhook call. Always answers 200 for events it chooses to ignore,
 * so Zalo does not keep retrying them; 401 only for bad signatures.
 */
export async function handleZaloWebhook(rawBody: string, signature: string | null, deps: ZaloDeps): Promise<WebhookOutcome> {
  let event: ZaloWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: "invalid json" };
  }

  const { appId, oaSecretKey } = deps.config;
  if (!(await verifySignature(signature, appId, rawBody, event.timestamp, oaSecretKey))) {
    return { status: 401, body: "bad signature" };
  }
  if (event.event_name !== "user_send_text" || !event.message?.text) {
    return { status: 200, body: "ignored" };
  }

  const userId = event.sender.id;
  const session = (await deps.loadSession(userId)) ?? newSession();
  const result = handleMessage(session, event.message.text, {
    vertical: deps.vertical,
    bookings: await deps.listBookings(),
    now: deps.now?.() ?? new Date(),
    locale: "vi",
    via: "zalo",
  });

  if (result.booking) await deps.saveBooking(result.booking);
  await deps.saveSession(userId, result.session);
  const sent = await deps.send(userId, renderText(result.reply, deps.vertical, "vi"));
  return { status: 200, body: sent.ok ? "replied" : `reply failed: ${sent.detail}` };
}
