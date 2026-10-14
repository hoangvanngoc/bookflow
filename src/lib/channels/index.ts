import type { Settings } from "../settings";
import { ConsoleChannel } from "./console";
import { WebhookChannel } from "./webhook";
import type { BookingEvent, DeliveryResult, NotificationChannel } from "./types";

export function channelsFor(settings: Settings): NotificationChannel[] {
  const channels: NotificationChannel[] = [new ConsoleChannel()];
  if (settings.webhookUrl) channels.push(new WebhookChannel(settings.webhookUrl));
  return channels;
}

/** Fan out to every channel. One failing channel never blocks the booking or the others. */
export async function dispatch(event: BookingEvent, channels: NotificationChannel[]): Promise<DeliveryResult[]> {
  const results = await Promise.allSettled(channels.map((c) => c.send(event)));
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { channel: channels[i].id, ok: false, detail: String(r.reason), at: new Date().toISOString() },
  );
}

export type { BookingEvent, DeliveryResult, NotificationChannel };
