import type { Booking, BookingDraft } from "./types";

/**
 * Storage is behind an interface so a real deployment can swap in its own backend
 * (a REST API, Supabase, the customer's existing CRM) without touching the UI.
 * The demo ships with browser storage only: every visitor gets a private sandbox.
 */
export interface BookingRepository {
  list(): Booking[];
  create(draft: BookingDraft): Booking;
  remove(id: string): void;
  clear(): void;
}

const KEY = "bookflow.bookings.v1";

export class LocalBookingRepository implements BookingRepository {
  private memory: Booking[] = [];

  list(): Booking[] {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Booking[]) : this.memory;
    } catch {
      // Private mode or blocked storage: keep working in memory for this tab.
      return this.memory;
    }
  }

  create(draft: BookingDraft): Booking {
    const booking: Booking = {
      ...draft,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.save([...this.list(), booking]);
    return booking;
  }

  remove(id: string): void {
    this.save(this.list().filter((b) => b.id !== id));
  }

  clear(): void {
    this.save([]);
  }

  private save(all: Booking[]): void {
    this.memory = all;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* memory copy above is enough */
    }
  }
}

let instance: BookingRepository | null = null;
export function bookings(): BookingRepository {
  instance ??= new LocalBookingRepository();
  return instance;
}
