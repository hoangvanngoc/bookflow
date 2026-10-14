import { describe, expect, it } from "vitest";
import { getVertical } from "@/verticals";
import { availableSlots, isOpenOn } from "./slots";
import type { Booking } from "./types";

const spa = getVertical("spa"); // 09:00–21:00 daily, capacity 3, 30-min step
const clinic = getVertical("clinic"); // closed Sunday
const body60 = spa.services.find((s) => s.id === "body-60")!;
const MORNING_BEFORE = new Date(2026, 9, 14, 7, 0); // Wed 14 Oct 2026, 07:00

function booking(start: string, serviceId = "body-60", date = "2026-10-15"): Booking {
  return { id: start + Math.random(), verticalId: "spa", serviceId, date, start, customerName: "x", phone: "1", note: "", createdAt: "" };
}

describe("availableSlots", () => {
  it("fits services inside opening hours", () => {
    const slots = availableSlots(spa, body60, "2026-10-15", [], MORNING_BEFORE);
    expect(slots[0]).toBe("09:00");
    expect(slots.at(-1)).toBe("20:00"); // 60 min must end by 21:00
  });

  it("blocks a slot once capacity is reached", () => {
    const full = [booking("10:00"), booking("10:00"), booking("10:00")];
    const slots = availableSlots(spa, body60, "2026-10-15", full, MORNING_BEFORE);
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("09:30"); // would overlap 10:00–10:30
    expect(slots).toContain("09:00");
    expect(slots).toContain("11:00");
  });

  it("ignores bookings from other days and other verticals", () => {
    const other = [booking("10:00", "body-60", "2026-10-16"), { ...booking("10:00"), verticalId: "salon" }];
    expect(availableSlots(spa, body60, "2026-10-15", [...other, ...other], MORNING_BEFORE)).toContain("10:00");
  });

  it("hides past times today", () => {
    const now = new Date(2026, 9, 15, 13, 10);
    const slots = availableSlots(spa, body60, "2026-10-15", [], now);
    expect(slots[0]).toBe("13:30");
  });

  it("returns nothing on a closed day", () => {
    expect(isOpenOn(clinic, "2026-10-18")).toBe(false); // Sunday
    expect(availableSlots(clinic, clinic.services[0], "2026-10-18", [], MORNING_BEFORE)).toEqual([]);
  });
});
