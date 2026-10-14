import { describe, expect, it, vi } from "vitest";
import { dispatch, type BookingEvent, type NotificationChannel } from ".";
import { WebhookChannel } from "./webhook";

const event: BookingEvent = {
  type: "booking.created",
  serviceName: "Body massage",
  businessName: "Lotus Day Spa",
  booking: { id: "1", verticalId: "spa", serviceId: "body-60", date: "2026-10-15", start: "15:00", customerName: "An", phone: "090", note: "", createdAt: "" },
};

describe("WebhookChannel", () => {
  it("POSTs the event as JSON", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    const result = await new WebhookChannel("https://hook.test", fetchMock as unknown as typeof fetch).send(event);
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hook.test");
    expect(JSON.parse(init.body as string).booking.start).toBe("15:00");
  });

  it("reports a non-2xx response as failed", async () => {
    const fetchMock = async () => new Response(null, { status: 500 });
    const result = await new WebhookChannel("https://hook.test", fetchMock as unknown as typeof fetch).send(event);
    expect(result).toMatchObject({ ok: false, detail: "HTTP 500" });
  });
});

describe("dispatch", () => {
  it("keeps going when one channel throws", async () => {
    const broken: NotificationChannel = { id: "broken", label: "", send: async () => Promise.reject(new Error("boom")) };
    const fine: NotificationChannel = { id: "fine", label: "", send: async () => ({ channel: "fine", ok: true, detail: "", at: "" }) };
    const results = await dispatch(event, [broken, fine]);
    expect(results.map((r) => [r.channel, r.ok])).toEqual([["broken", false], ["fine", true]]);
  });
});
