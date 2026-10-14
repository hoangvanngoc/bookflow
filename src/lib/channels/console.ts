import type { BookingEvent, DeliveryResult, NotificationChannel } from "./types";

/** Always-on channel for local testing: writes the event to the browser console. */
export class ConsoleChannel implements NotificationChannel {
  readonly id = "console";
  readonly label = "Browser console";

  async send(event: BookingEvent): Promise<DeliveryResult> {
    console.info("[bookflow] %s", event.type, event);
    return { channel: this.id, ok: true, detail: "Logged to console", at: new Date().toISOString() };
  }
}
