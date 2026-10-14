import type { Vertical } from "@/verticals";
import { parseRequest } from "../assistant/parse";
import { planReply, type Partial } from "../assistant/reply";
import type { Booking, BookingDraft } from "../types";
import { dayLabel, strings, type Locale } from "./strings";

/**
 * Channel-agnostic booking conversation for chat apps (Zalo, Messenger, SMS).
 * Pure: state in, state out. The channel adapter stores the session and sends
 * the text; this file never touches the network.
 */

export type ChatOption = { kind: "service"; id: string } | { kind: "date"; date: string } | { kind: "time"; time: string };

export type ChatSession = {
  stage: "booking" | "contact";
  draft: Partial;
  /** Options from the last question, so "2" can be resolved. */
  options: ChatOption[];
};

export type ChatReply = { text: string; options: ChatOption[] };

export type ChatContext = {
  vertical: Vertical;
  bookings: Booking[];
  now: Date;
  locale: Locale;
  /** Display name from the chat platform, used when the customer only sends a phone number. */
  displayName?: string;
  via: NonNullable<BookingDraft["via"]>;
};

export type ChatResult = { session: ChatSession; reply: ChatReply; booking?: BookingDraft };

export const newSession = (): ChatSession => ({
  stage: "booking",
  draft: { serviceId: null, date: null, time: null },
  options: [],
});

const RESET = /^(hủy|huỷ|huy|bắt đầu lại|reset|cancel|start over)$/i;

export function handleMessage(session: ChatSession, text: string, ctx: ChatContext): ChatResult {
  const t = strings[ctx.locale];
  const msg = text.trim();

  if (RESET.test(msg)) return { session: newSession(), reply: { text: t.reset, options: [] } };

  // A bare number picks from the last list of options.
  const picked = /^\d{1,2}$/.test(msg) ? session.options[Number(msg) - 1] : undefined;

  if (session.stage === "contact" && !picked) return takeContact(session, msg, ctx);

  let draft = session.draft;
  if (picked) {
    draft = applyOption(draft, picked);
  } else {
    const p = parseRequest(msg, ctx.vertical, ctx.now);
    draft = {
      serviceId: p.serviceId ?? draft.serviceId,
      date: p.date ?? draft.date,
      time: p.time ?? draft.time,
    };
  }
  return ask(draft, ctx);
}

function ask(draft: Partial, ctx: ChatContext): ChatResult {
  const t = strings[ctx.locale];
  const r = planReply(draft, ctx.vertical, ctx.bookings, ctx.now);
  const name = (id: string) => ctx.vertical.services.find((s) => s.id === id)?.name ?? id;
  const day = (d: string) => dayLabel(d, ctx.locale);

  if (r.kind === "ask-service") {
    const options = ctx.vertical.services.map((s): ChatOption => ({ kind: "service", id: s.id }));
    return result({ stage: "booking", draft, options }, t.askService);
  }
  if (r.kind === "ask-date") {
    const options = r.options.map((d): ChatOption => ({ kind: "date", date: d }));
    const text = !options.length ? t.noDays : r.reason === "closed" ? t.closed(day(r.requested)) : t.full(day(r.requested));
    return result({ stage: "booking", draft, options }, text);
  }
  const resolved = { ...draft, date: r.date };
  if (r.kind === "ask-time") {
    const options = r.options.map((x): ChatOption => ({ kind: "time", time: x }));
    const text = !options.length
      ? t.noTimes(day(r.date))
      : r.requested
        ? t.timeTaken(r.requested, day(r.date))
        : t.askTime(name(r.serviceId), day(r.date));
    return result({ stage: "booking", draft: { ...resolved, time: null }, options }, text);
  }
  return result({ stage: "contact", draft: resolved, options: [] }, t.askContact(name(r.serviceId), day(r.date), r.time));
}

function takeContact(session: ChatSession, msg: string, ctx: ChatContext): ChatResult {
  const t = strings[ctx.locale];
  const cleaned = msg.replace(/[.\-]/g, "");
  const phoneMatch = cleaned.match(/(\+?84|0)(?:\s?\d){8,10}/);
  if (!phoneMatch) {
    // No phone, but maybe a change of mind ("đổi sang 5h chiều"): re-plan with it.
    const p = parseRequest(msg, ctx.vertical, ctx.now);
    if (p.serviceId || p.date || p.time) {
      const d = session.draft;
      return ask({ serviceId: p.serviceId ?? d.serviceId, date: p.date ?? d.date, time: p.time ?? d.time }, ctx);
    }
    return result({ ...session, options: [] }, t.needPhone);
  }
  const phone = phoneMatch[0].replace(/\s/g, "");

  // The slot may have gone while the customer was typing: plan again before booking.
  const check = ask(session.draft, ctx);
  if (check.session.stage !== "contact") return check;

  const { serviceId, date, time } = check.session.draft as Required<{ [K in keyof Partial]: string }>;
  const name =
    cleaned
      .replace(phoneMatch[0], "")
      .replace(/[,:;]|\b(tên|ten|sđt|sdt|name|phone)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim() ||
    ctx.displayName ||
    t.defaultName;

  const booking: BookingDraft = {
    verticalId: ctx.vertical.id,
    serviceId,
    date,
    start: time,
    customerName: name,
    phone,
    note: "",
    via: ctx.via,
  };
  const serviceName = ctx.vertical.services.find((s) => s.id === serviceId)?.name ?? serviceId;
  return {
    session: newSession(),
    reply: { text: t.confirmed(name, serviceName, dayLabel(date, ctx.locale), time), options: [] },
    booking,
  };
}

function applyOption(d: Partial, o: ChatOption): Partial {
  if (o.kind === "service") return { ...d, serviceId: o.id };
  if (o.kind === "date") return { ...d, date: o.date };
  return { ...d, time: o.time };
}

function result(session: ChatSession, text: string): ChatResult {
  return { session, reply: { text, options: session.options } };
}

/** Plain-text rendering for channels without buttons: a numbered list under the question. */
export function renderText(reply: ChatReply, vertical: Vertical, locale: Locale): string {
  if (!reply.options.length) return reply.text;
  const lines = reply.options.map((o, i) => `${i + 1}. ${optionLabel(o, vertical, locale)}`);
  return [reply.text, ...lines, strings[locale].replyWithNumber].join("\n");
}

export function optionLabel(o: ChatOption, vertical: Vertical, locale: Locale): string {
  if (o.kind === "service") return vertical.services.find((s) => s.id === o.id)?.name ?? o.id;
  if (o.kind === "date") return dayLabel(o.date, locale);
  return o.time;
}
