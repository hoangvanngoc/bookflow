import { describe, expect, it } from "vitest";
import { getVertical } from "@/verticals";
import { parseRequest } from "./parse";
import { parseWithLlm } from "./llm";

const spa = getVertical("spa");
const salon = getVertical("salon");
const TODAY = new Date(2026, 9, 14, 9, 0); // Wednesday 14 Oct 2026

describe("parseRequest (English)", () => {
  it.each([
    ["body massage tomorrow 3pm", "body-60", "2026-10-15", "15:00"],
    ["foot reflexology today at 10:30am", "foot-45", "2026-10-14", "10:30"],
    ["hot stone on friday 7pm", "hotstone-90", "2026-10-16", "19:00"],
    ["massage 20/10 at 14:00", "body-60", "2026-10-20", "14:00"],
  ])("%s", (text, serviceId, date, time) => {
    expect(parseRequest(text, spa, TODAY)).toMatchObject({ serviceId, date, time });
  });
});

describe("parseRequest (Vietnamese)", () => {
  it.each([
    ["mai 3h chiều massage chân", "foot-45", "2026-10-15", "15:00"],
    ["cho em đặt đá nóng thứ 7 lúc 10h sáng", "hotstone-90", "2026-10-17", "10:00"],
    ["hôm nay 19h30 massage toàn thân", "body-60", "2026-10-14", "19:30"],
    ["chủ nhật 8 giờ tối", null, "2026-10-18", "20:00"],
  ])("%s", (text, serviceId, date, time) => {
    expect(parseRequest(text, spa, TODAY)).toMatchObject({ serviceId, date, time });
  });

  it("does not read durations as times", () => {
    expect(parseRequest("massage 60 phút", spa, TODAY).time).toBeNull();
  });

  it("prefers the longest keyword", () => {
    expect(parseRequest("cắt tóc", salon, TODAY).serviceId).toBe("cut");
  });

  it("rolls a past date without year into next year", () => {
    expect(parseRequest("massage 01/02", spa, TODAY).date).toBe("2027-02-01");
  });
});

describe("parseWithLlm", () => {
  const config = { baseUrl: "https://example.test/v1", model: "m", apiKey: "k" };
  const reply = (content: string) =>
    (async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }))) as unknown as typeof fetch;

  it("skips the network without a key", async () => {
    const r = await parseWithLlm("massage tomorrow 3pm", spa, TODAY, { ...config, apiKey: "" }, () => {
      throw new Error("should not be called");
    });
    expect(r.source).toBe("rules");
  });

  it("accepts valid model output", async () => {
    const r = await parseWithLlm("x", spa, TODAY, config, reply('{"serviceId":"foot-45","date":"2026-10-20","time":"09:00"}'));
    expect(r).toEqual({ serviceId: "foot-45", date: "2026-10-20", time: "09:00", source: "llm" });
  });

  it("rejects fields that are not in the catalogue", async () => {
    const r = await parseWithLlm("body massage", spa, TODAY, config, reply('{"serviceId":"facial","date":"soon","time":"25:00"}'));
    expect(r).toMatchObject({ serviceId: "body-60", date: null, time: null });
  });

  it("falls back on network errors", async () => {
    const r = await parseWithLlm("massage tomorrow 3pm", spa, TODAY, config, (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch);
    expect(r).toMatchObject({ source: "rules", time: "15:00" });
  });
});
