/**
 * A vertical is everything that changes between one customer deployment and the next.
 * Onboarding a new business means writing one of these files, not touching app code.
 */
export type Service = {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  /** Words customers actually use for this service; feeds the text assistant. */
  keywords: string[];
};

export type OpeningHours = {
  /** 0 = Sunday … 6 = Saturday. Days not listed are closed. */
  days: number[];
  open: string; // "HH:MM"
  close: string; // "HH:MM"
};

export type Vertical = {
  id: string;
  businessName: string;
  tagline: string;
  /** What the business calls the person being booked: "therapist", "doctor", "stylist". */
  providerLabel: string;
  /** How many bookings can overlap (rooms, chairs, doctors). */
  capacity: number;
  slotStepMin: number;
  currency: string;
  hours: OpeningHours;
  services: Service[];
  accent: string;
};
