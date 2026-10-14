import type { Vertical } from "@/verticals";
import { toISODate } from "../time";
import { parseRequest, type ParsedRequest } from "./parse";

export type LlmConfig = { baseUrl: string; model: string; apiKey: string };

/**
 * Optional LLM path for messages the rules miss. Bring your own key: the repo and
 * the hosted demo ship without one. Any OpenAI-compatible endpoint works
 * (OpenRouter, a local Ollama, a customer's private gateway).
 *
 * The model is only trusted for structure. Every field is validated against the
 * vertical's real catalogue, and anything invalid falls back to the rule parser.
 */
export async function parseWithLlm(
  text: string,
  vertical: Vertical,
  today: Date,
  config: LlmConfig,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<ParsedRequest> {
  const fallback = parseRequest(text, vertical, today);
  if (!config.apiKey) return fallback;

  const catalogue = vertical.services.map((s) => `${s.id}: ${s.name}`).join("\n");
  const system = [
    `You extract booking requests for ${vertical.businessName}.`,
    `Today is ${toISODate(today)} (${today.toLocaleDateString("en-US", { weekday: "long" })}).`,
    `Services (id: name):\n${catalogue}`,
    `Reply with JSON only: {"serviceId": string|null, "date": "YYYY-MM-DD"|null, "time": "HH:MM"|null}.`,
    `Use null for anything the customer did not say. The message may be in Vietnamese or English.`,
  ].join("\n");

  try {
    const res = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const raw = JSON.parse(content.replace(/^```(json)?|```$/g, "").trim());
    return {
      serviceId: vertical.services.some((s) => s.id === raw.serviceId) ? raw.serviceId : fallback.serviceId,
      date: /^\d{4}-\d{2}-\d{2}$/.test(raw.date ?? "") ? raw.date : fallback.date,
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time ?? "") ? raw.time : fallback.time,
      source: "llm",
    };
  } catch {
    return fallback;
  }
}
