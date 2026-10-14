import type { Booking } from "../types";

export type BookingEvent = {
  type: "booking.created";
  booking: Booking;
  serviceName: string;
  businessName: string;
};

export type DeliveryResult = {
  channel: string;
  ok: boolean;
  detail: string;
  at: string;
};

/**
 * Where a booking goes after it is made. Each customer deployment wires up the
 * channels that business already uses: a chat app, their CRM, a Google Sheet via
 * Zapier, an SMS gateway. Adding one is a new class, not a change to the booking flow.
 */
export interface NotificationChannel {
  readonly id: string;
  readonly label: string;
  send(event: BookingEvent): Promise<DeliveryResult>;
}
