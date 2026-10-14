/**
 * Zalo Official Account webhook on Cloudflare Workers.
 *
 * Zalo  ──POST /zalo/webhook──►  this Worker  ──►  handleZaloWebhook()  ──►  Zalo send API
 *                                     │
 *                                     └── KV: chat sessions (24 h TTL) + bookings
 *
 * Secrets are set with `wrangler secret put`, never written in this repo.
 * See README.md next to this file.
 */
import { ZaloOaClient } from "../../src/lib/channels/zalo/client";
import { handleZaloWebhook } from "../../src/lib/channels/zalo/handler";
import type { ChatSession } from "../../src/lib/conversation/engine";
import type { Booking } from "../../src/lib/types";
import type { Vertical } from "../../src/verticals/types";
import clinic from "../../src/verticals/clinic.json";
import salon from "../../src/verticals/salon.json";
import spa from "../../src/verticals/spa.json";

/** The two KV methods used here; matches Cloudflare's KVNamespace. */
interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  BOOKFLOW_KV: KV;
  /** Which vertical config this OA serves: "spa", "clinic" or "salon". */
  VERTICAL_ID: string;
  ZALO_APP_ID: string;
  ZALO_OA_SECRET_KEY: string;
  ZALO_OA_ACCESS_TOKEN: string;
}

const verticals: Record<string, Vertical> = { spa, clinic, salon };
const SESSION_TTL_SECONDS = 60 * 60 * 24;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/zalo/webhook") {
      return new Response("not found", { status: 404 });
    }

    const vertical = verticals[env.VERTICAL_ID] ?? spa;
    const bookingsKey = `bookings:${vertical.id}`;
    const client = new ZaloOaClient(env.ZALO_OA_ACCESS_TOKEN);
    const listBookings = async (): Promise<Booking[]> => JSON.parse((await env.BOOKFLOW_KV.get(bookingsKey)) ?? "[]");

    const outcome = await handleZaloWebhook(await request.text(), request.headers.get("X-ZEvent-Signature"), {
      config: { appId: env.ZALO_APP_ID, oaSecretKey: env.ZALO_OA_SECRET_KEY, accessToken: env.ZALO_OA_ACCESS_TOKEN },
      vertical,
      loadSession: async (userId) => {
        const raw = await env.BOOKFLOW_KV.get(`session:${userId}`);
        return raw ? (JSON.parse(raw) as ChatSession) : null;
      },
      saveSession: (userId, session) =>
        env.BOOKFLOW_KV.put(`session:${userId}`, JSON.stringify(session), { expirationTtl: SESSION_TTL_SECONDS }),
      listBookings,
      // KV is fine for a pilot. Move to D1 or the customer's own system before real volume:
      // a read-modify-write on one key can lose a booking under concurrent writes.
      saveBooking: async (draft) => {
        const booking: Booking = { ...draft, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        await env.BOOKFLOW_KV.put(bookingsKey, JSON.stringify([...(await listBookings()), booking]));
        return booking;
      },
      send: (userId, text) => client.sendText(userId, text),
    });

    return new Response(outcome.body, { status: outcome.status });
  },
};
