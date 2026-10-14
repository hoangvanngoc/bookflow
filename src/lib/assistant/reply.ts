import type { Vertical } from "@/verticals";
import { availableSlots } from "../slots";
import { addDays, toISODate, toMinutes } from "../time";
import type { Booking } from "../types";

export type Partial = { serviceId: string | null; date: string | null; time: string | null };

/**
 * What the assistant says next. Instead of failing when a message is incomplete
 * or asks for something unavailable, it asks one short follow-up with tappable
 * answers, the way a good receptionist would.
 */
export type AssistantReply =
  | { kind: "ready"; serviceId: string; date: string; time: string }
  | { kind: "ask-service" }
  | { kind: "ask-date"; serviceId: string; reason: "closed" | "full"; requested: string; options: string[] }
  | { kind: "ask-time"; serviceId: string; date: string; requested: string | null; options: string[] };

const MAX_OPTIONS = 6;
const DAYS_AHEAD = 14;

export function planReply(p: Partial, vertical: Vertical, bookings: Booking[], now: Date): AssistantReply {
  const service = vertical.services.find((s) => s.id === p.serviceId);
  if (!service) return { kind: "ask-service" };

  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => toISODate(addDays(now, i)));
  const slotsOn = (d: string) => availableSlots(vertical, service, d, bookings, now);

  let date = p.date;
  if (date) {
    if (slotsOn(date).length === 0) {
      const reason = vertical.hours.days.includes(new Date(`${date}T12:00`).getDay()) ? "full" : "closed";
      const options = days.filter((d) => d > date! && slotsOn(d).length > 0).slice(0, 3);
      return { kind: "ask-date", serviceId: service.id, reason, requested: date, options };
    }
  } else {
    // No day given: the first day that has the requested time, else the first with anything free.
    date =
      (p.time && days.find((d) => slotsOn(d).includes(p.time!))) ||
      days.find((d) => slotsOn(d).length > 0) ||
      days[0];
  }

  const slots = slotsOn(date);
  if (p.time && slots.includes(p.time)) return { kind: "ready", serviceId: service.id, date, time: p.time };

  const options = p.time ? nearest(slots, p.time) : slots.slice(0, MAX_OPTIONS);
  return { kind: "ask-time", serviceId: service.id, date, requested: p.time, options };
}

function nearest(slots: string[], target: string): string[] {
  const t = toMinutes(target);
  return [...slots]
    .sort((a, b) => Math.abs(toMinutes(a) - t) - Math.abs(toMinutes(b) - t))
    .slice(0, MAX_OPTIONS)
    .sort();
}
