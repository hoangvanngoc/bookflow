import type { DeliveryResult } from "./types";

const KEY = "bookflow.deliveries.v1";
const MAX = 20;

export type DeliveryLogEntry = DeliveryResult & { bookingId: string };

/** Last few delivery attempts, so the admin screen can show what each channel did. */
export function readDeliveryLog(): DeliveryLogEntry[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function appendDeliveryLog(bookingId: string, results: DeliveryResult[]): void {
  const next = [...results.map((r) => ({ ...r, bookingId })), ...readDeliveryLog()].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function clearDeliveryLog(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
