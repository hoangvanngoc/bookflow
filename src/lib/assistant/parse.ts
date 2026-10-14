import type { Vertical } from "@/verticals";
import { addDays, toISODate } from "../time";

export type ParsedRequest = {
  serviceId: string | null;
  date: string | null; // "YYYY-MM-DD"
  time: string | null; // "HH:MM"
  source: "rules" | "llm";
};

/**
 * Turns a customer message such as "massage tomorrow 3pm" or
 * "mai 3h chiều massage chân" into booking fields. Rule-based on purpose: it runs
 * offline, costs nothing, and is predictable. The optional LLM path (llm.ts) falls
 * back to this when no key is configured or the model returns something invalid.
 * Understands English and Vietnamese.
 */
export function parseRequest(text: string, vertical: Vertical, today: Date): ParsedRequest {
  const t = text.toLowerCase().normalize("NFC");
  return {
    serviceId: matchService(t, vertical),
    date: matchDate(t, today),
    time: matchTime(t),
    source: "rules",
  };
}

function matchService(t: string, vertical: Vertical): string | null {
  let best: { id: string; score: number } | null = null;
  for (const s of vertical.services) {
    for (const kw of s.keywords) {
      const k = kw.toLowerCase();
      if (t.includes(k) && (!best || k.length > best.score)) best = { id: s.id, score: k.length };
    }
  }
  return best?.id ?? null;
}

const EN_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
// Index = JS weekday. Vietnamese counts Monday as "thứ 2".
const VI_DAYS: Array<string[]> = [
  ["chủ nhật", "cn"],
  ["thứ 2", "thứ hai"],
  ["thứ 3", "thứ ba"],
  ["thứ 4", "thứ tư"],
  ["thứ 5", "thứ năm"],
  ["thứ 6", "thứ sáu"],
  ["thứ 7", "thứ bảy"],
];

function matchDate(t: string, today: Date): string | null {
  const explicit = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (explicit) {
    const [, d, m, y] = explicit;
    let date = new Date(y ? Number(y) : today.getFullYear(), Number(m) - 1, Number(d));
    if (!y && date < startOfDay(today)) date = new Date(today.getFullYear() + 1, Number(m) - 1, Number(d));
    return toISODate(date);
  }
  if (/\b(today|tonight)\b|hôm nay|tối nay|chiều nay/.test(t)) return toISODate(today);
  if (/day after tomorrow|ngày kia|ngày mốt|\bmốt\b/.test(t)) return toISODate(addDays(today, 2));
  if (/\btomorrow\b|ngày mai|(^|\s)mai(\s|$)/.test(t)) return toISODate(addDays(today, 1));

  for (let wd = 0; wd < 7; wd++) {
    const en = EN_DAYS[wd];
    const hit = new RegExp(`\\b(${en}|${en.slice(0, 3)})\\b`).test(t) || VI_DAYS[wd].some((w) => hasWord(t, w));
    if (hit) return toISODate(addDays(today, (wd - today.getDay() + 7) % 7));
  }
  return null;
}

function matchTime(t: string): string | null {
  // Drop things that look like times but are not: dates and durations.
  const cleaned = t
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{4})?\b/g, " ")
    .replace(/\b\d+\s*(min|mins|minutes|phút|p)\b/g, " ")
    .replace(/thứ\s*\d/g, " ");

  const re = /(\d{1,2})\s*(?:(:|h|giờ)\s*(\d{2})?)?\s*(am|pm|sáng|trưa|chiều|tối)?/g;
  for (const m of cleaned.matchAll(re)) {
    const [, hRaw, sep, minRaw, meridiem] = m;
    if (!sep && !meridiem) continue; // a bare number is not a time
    let h = Number(hRaw);
    const min = minRaw ? Number(minRaw) : 0;
    if (meridiem === "pm" || meridiem === "chiều" || meridiem === "tối") {
      if (h < 12) h += 12;
    } else if (meridiem === "am" && h === 12) {
      h = 0;
    } else if (meridiem === "trưa" && h < 6) {
      h += 12;
    }
    if (h > 23 || min > 59) continue;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  return null;
}

function hasWord(t: string, w: string): boolean {
  return new RegExp(`(^|[\\s,.])${w}($|[\\s,.])`).test(t);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
