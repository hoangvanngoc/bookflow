import type { Service, Vertical } from "@/verticals";
import type { Booking } from "./types";
import { fromISODate, fromMinutes, toISODate, toMinutes } from "./time";

export function isOpenOn(vertical: Vertical, date: string): boolean {
  return vertical.hours.days.includes(fromISODate(date).getDay());
}

/**
 * Start times on `date` where `service` fits inside opening hours and
 * fewer than `capacity` existing bookings overlap it.
 *
 * Counting every overlapping booking is slightly conservative (two bookings that
 * overlap the candidate but not each other still count as two). For a demo that is
 * the right trade: it can never double-book.
 */
export function availableSlots(
  vertical: Vertical,
  service: Service,
  date: string,
  bookings: Booking[],
  now: Date = new Date(),
): string[] {
  if (!isOpenOn(vertical, date)) return [];

  const open = toMinutes(vertical.hours.open);
  const close = toMinutes(vertical.hours.close);
  const isToday = date === toISODate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const sameDay = bookings
    .filter((b) => b.verticalId === vertical.id && b.date === date)
    .map((b) => {
      const dur = vertical.services.find((s) => s.id === b.serviceId)?.durationMin ?? 0;
      const start = toMinutes(b.start);
      return { start, end: start + dur };
    });

  const slots: string[] = [];
  for (let start = open; start + service.durationMin <= close; start += vertical.slotStepMin) {
    if (isToday && start <= nowMin) continue;
    const end = start + service.durationMin;
    const overlapping = sameDay.filter((b) => b.start < end && start < b.end).length;
    if (overlapping < vertical.capacity) slots.push(fromMinutes(start));
  }
  return slots;
}
