import { describe, expect, it } from "vitest";
import { getVertical } from "@/verticals";
import type { Booking } from "../types";
import { handleMessage, newSession, renderText, type ChatContext, type ChatSession } from "./engine";

const spa = getVertical("spa");
const NOW = new Date(2026, 9, 14, 7, 0); // Wed 14 Oct 2026
const ctx = (bookings: Booking[] = [], extra: Partial<ChatContext> = {}): ChatContext => ({
  vertical: spa, bookings, now: NOW, locale: "vi", via: "zalo", ...extra,
});

function say(session: ChatSession, text: string, c = ctx()) {
  return handleMessage(session, text, c);
}

describe("chat engine (Vietnamese)", () => {
  it("books end to end: request, pick by number, contact", () => {
    const r1 = say(newSession(), "hot stone thứ 7");
    expect(r1.reply.text).toBe("Hot stone massage ngày T7 17/10. Anh/chị muốn mấy giờ ạ?");
    expect(r1.reply.options[2]).toEqual({ kind: "time", time: "10:00" });

    const r2 = say(r1.session, "3");
    expect(r2.session.stage).toBe("contact");
    expect(r2.reply.text).toContain("lúc 10:00 ngày T7 17/10 còn trống");

    const r3 = say(r2.session, "Tên: Lan, sđt 0901 234 567");
    expect(r3.booking).toEqual({
      verticalId: "spa", serviceId: "hotstone-90", date: "2026-10-17", start: "10:00",
      customerName: "Lan", phone: "0901234567", note: "", via: "zalo",
    });
    expect(r3.reply.text).toBe("Đã đặt xong cho Lan: Hot stone massage lúc 10:00 ngày T7 17/10. Hẹn gặp anh/chị!");
    expect(r3.session).toEqual(newSession());
  });

  it("goes straight to contact when the first message has everything", () => {
    const r = say(newSession(), "mai 3h chiều massage chân");
    expect(r.session).toMatchObject({ stage: "contact", draft: { serviceId: "foot-45", date: "2026-10-15", time: "15:00" } });
  });

  it("asks for the service first when it is missing", () => {
    const r = say(newSession(), "mai 10h");
    expect(r.reply.text).toBe("Chào anh/chị, mình muốn đặt dịch vụ nào ạ?");
    expect(say(r.session, "2").session.stage).toBe("contact"); // foot reflexology, tomorrow 10:00
  });

  it("asks again when the contact has no phone", () => {
    const contact = say(newSession(), "mai 3h chiều massage chân").session;
    const r = say(contact, "Lan");
    expect(r.booking).toBeUndefined();
    expect(r.reply.text).toContain("chưa thấy số điện thoại");
  });

  it("accepts a change of mind at the contact step", () => {
    const contact = say(newSession(), "mai 3h chiều massage chân").session;
    const r = say(contact, "đổi sang 5h chiều");
    expect(r.session).toMatchObject({ stage: "contact", draft: { time: "17:00" } });
  });

  it("falls back to the platform display name", () => {
    const contact = say(newSession(), "mai 3h chiều massage chân").session;
    const r = say(contact, "0901234567", ctx([], { displayName: "Trần Lan" }));
    expect(r.booking?.customerName).toBe("Trần Lan");
  });

  it("re-checks the slot before booking", () => {
    const contact = say(newSession(), "mai 3h chiều massage chân").session;
    const taken: Booking[] = [1, 2, 3].map((i) => ({
      id: String(i), verticalId: "spa", serviceId: "foot-45", date: "2026-10-15", start: "15:00",
      customerName: "x", phone: "1", note: "", createdAt: "",
    }));
    const r = say(contact, "Lan 0901234567", ctx(taken));
    expect(r.booking).toBeUndefined();
    expect(r.reply.text).toContain("đã kín");
  });

  it("resets on hủy", () => {
    const contact = say(newSession(), "mai 3h chiều massage chân").session;
    expect(say(contact, "hủy").session).toEqual(newSession());
  });
});

describe("renderText", () => {
  it("numbers the options for plain-text channels", () => {
    const r = say(newSession(), "massage chân thứ 7");
    const text = renderText(r.reply, spa, "vi").split("\n");
    expect(text[1]).toBe("1. 09:00");
    expect(text.at(-1)).toBe("Trả lời bằng số thứ tự để chọn.");
  });
});
