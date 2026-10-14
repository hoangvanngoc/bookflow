export type Booking = {
  id: string;
  verticalId: string;
  serviceId: string;
  date: string; // "YYYY-MM-DD", local to the business
  start: string; // "HH:MM"
  customerName: string;
  phone: string;
  note: string;
  createdAt: string; // ISO
};

export type BookingDraft = Omit<Booking, "id" | "createdAt">;
