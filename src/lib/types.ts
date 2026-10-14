export type Booking = {
  id: string;
  verticalId: string;
  serviceId: string;
  date: string; // "YYYY-MM-DD", local to the business
  start: string; // "HH:MM"
  customerName: string;
  phone: string;
  note: string;
  /** How the booking was started. Older records have no value and count as "form". */
  via?: "assistant" | "zalo" | "form";
  createdAt: string; // ISO
};

export type BookingDraft = Omit<Booking, "id" | "createdAt">;
