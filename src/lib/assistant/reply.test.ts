import { describe, expect, it } from "vitest";
import { getVertical } from "@/verticals";
import type { Booking } from "../types";
import { planReply } from "./reply";

const spa = getVertical("spa"); // daily 09:00–21:00, capacity 3
const clinic = getVertical("clinic"); // closed Sunday
const NOW = new Date(2026, 9, 14, 7, 0); // Wed 14 Oct 2026, before opening

function full(date: string, start: string): Booking[] {
  return [1, 2, 3].map((i) => ({
    id: `${start}-${i}`, verticalId: "spa", serviceId: "body-60", date, start,
    customerName: "x", phone: "1", note: "", createdAt: "",
  }));
}

describe("planReply", () => {
  it("is ready when everything is given and free", () => {
    expect(planReply({ serviceId: "body-60", date: "2026-10-15", time: "15:00" }, spa, [], NOW)).toEqual({
      kind: "ready", serviceId: "body-60", date: "2026-10-15", time: "15:00",
    });
  });

  it("asks for the service when it is missing", () => {
    expect(planReply({ serviceId: null, date: "2026-10-15", time: "15:00" }, spa, [], NOW).kind).toBe("ask-service");
  });

  it("offers times when only the time is missing", () => {
    const r = planReply({ serviceId: "body-60", date: "2026-10-15", time: null }, spa, [], NOW);
    expect(r).toMatchObject({ kind: "ask-time", date: "2026-10-15", requested: null });
    expect(r.kind === "ask-time" && r.options).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
  });

  it("offers the closest free times when the requested one is taken", () => {
    const r = planReply({ serviceId: "body-60", date: "2026-10-15", time: "15:00" }, spa, full("2026-10-15", "15:00"), NOW);
    expect(r.kind).toBe("ask-time");
    // 14:30 and 15:30 overlap the full 15:00–16:00 block, so they are gone too.
    expect(r.kind === "ask-time" && r.options).toEqual(["13:00", "13:30", "14:00", "16:00", "16:30", "17:00"]);
  });

  it("suggests other days when the business is closed", () => {
    const r = planReply({ serviceId: "checkup", date: "2026-10-18", time: "10:00" }, clinic, [], NOW);
    expect(r).toEqual({
      kind: "ask-date", serviceId: "checkup", reason: "closed", requested: "2026-10-18",
      options: ["2026-10-19", "2026-10-20", "2026-10-21"],
    });
  });

  it("picks a day when none was given", () => {
    const r = planReply({ serviceId: "checkup", date: null, time: "10:00" }, clinic, [], NOW);
    expect(r).toMatchObject({ kind: "ready", date: "2026-10-14", time: "10:00" });
  });
});
