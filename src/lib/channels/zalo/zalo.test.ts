import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { getVertical } from "@/verticals";
import type { ChatSession } from "../../conversation/engine";
import type { Booking, BookingDraft } from "../../types";
import { ZaloOaClient } from "./client";
import { handleZaloWebhook, type ZaloDeps } from "./handler";
import { verifySignature } from "./signature";

const config = { appId: "app-1", oaSecretKey: "test-secret", accessToken: "test-token" };

function signed(text: string, eventName = "user_send_text") {
  const body = JSON.stringify({
    app_id: config.appId,
    event_name: eventName,
    timestamp: "1792000000000",
    sender: { id: "user-1" },
    recipient: { id: "oa-1" },
    message: { text, msg_id: "m1" },
  });
  const mac = createHash("sha256").update(config.appId + body + "1792000000000" + config.oaSecretKey).digest("hex");
  return { body, header: `mac=${mac}` };
}

function fakeDeps() {
  const sessions = new Map<string, ChatSession>();
  const bookings: Booking[] = [];
  const sent: string[] = [];
  const deps: ZaloDeps = {
    config,
    vertical: getVertical("spa"),
    loadSession: async (id) => sessions.get(id) ?? null,
    saveSession: async (id, s) => void sessions.set(id, s),
    listBookings: async () => bookings,
    saveBooking: async (d: BookingDraft) => {
      const b = { ...d, id: String(bookings.length + 1), createdAt: "" };
      bookings.push(b);
      return b;
    },
    send: async (_id, text) => {
      sent.push(text);
      return { ok: true, detail: "sent" };
    },
    now: () => new Date(2026, 9, 14, 7, 0),
  };
  return { deps, bookings, sent };
}

describe("verifySignature", () => {
  it("accepts Zalo's mac and rejects tampering", async () => {
    const { body, header } = signed("hi");
    expect(await verifySignature(header, config.appId, body, "1792000000000", config.oaSecretKey)).toBe(true);
    expect(await verifySignature(header, config.appId, body + " ", "1792000000000", config.oaSecretKey)).toBe(false);
    expect(await verifySignature(null, config.appId, body, "1792000000000", config.oaSecretKey)).toBe(false);
  });
});

describe("handleZaloWebhook", () => {
  it("runs a whole booking over three messages", async () => {
    const { deps, bookings, sent } = fakeDeps();
    for (const text of ["hot stone thứ 7", "3", "Lan 0901234567"]) {
      const { body, header } = signed(text);
      expect(await handleZaloWebhook(body, header, deps)).toEqual({ status: 200, body: "replied" });
    }
    expect(sent[0]).toContain("\n3. 10:00\n");
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({ customerName: "Lan", start: "10:00", via: "zalo" });
  });

  it("rejects a bad signature", async () => {
    const { deps, sent } = fakeDeps();
    const { body } = signed("hi");
    expect((await handleZaloWebhook(body, "mac=deadbeef", deps)).status).toBe(401);
    expect(sent).toHaveLength(0);
  });

  it("acknowledges and ignores non-text events", async () => {
    const { deps, sent } = fakeDeps();
    const { body, header } = signed("", "follow");
    expect(await handleZaloWebhook(body, header, deps)).toEqual({ status: 200, body: "ignored" });
    expect(sent).toHaveLength(0);
  });
});

describe("ZaloOaClient", () => {
  it("sends with the access token header and reads Zalo's error code", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 0, message: "Success" })));
    const ok = await new ZaloOaClient("tok", fetchMock as unknown as typeof fetch).sendText("u1", "xin chào");
    expect(ok.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).access_token).toBe("tok");
    expect(JSON.parse(init.body as string)).toEqual({ recipient: { user_id: "u1" }, message: { text: "xin chào" } });
  });

  it("treats a non-zero error code as failure", async () => {
    const fetchMock = async () => new Response(JSON.stringify({ error: -216, message: "Access token is invalid" }));
    const r = await new ZaloOaClient("tok", fetchMock as unknown as typeof fetch).sendText("u1", "x");
    expect(r).toMatchObject({ ok: false });
    expect(r.detail).toContain("-216");
  });
});
