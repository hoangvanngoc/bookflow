"use client";

import { useEffect, useRef, useState } from "react";
import { channelsFor, dispatch } from "@/lib/channels";
import { appendDeliveryLog } from "@/lib/channels/log";
import { handleMessage, newSession, renderText, type ChatOption, type ChatSession } from "@/lib/conversation/engine";
import type { Locale } from "@/lib/conversation/strings";
import { loadSettings } from "@/lib/settings";
import { bookings } from "@/lib/store";
import { useVertical } from "../providers";

type Line = { from: "user" | "oa"; text: string; options?: ChatOption[] };

const GREETING: Record<Locale, (name: string, example: string) => string> = {
  vi: (name, example) => `Chào mừng anh/chị đến với ${name}! Nhắn nhu cầu đặt lịch cho mình, ví dụ: "${example}"`,
  en: (name, example) => `Welcome to ${name}! Tell me what you'd like to book, for example: "${example}"`,
};

/**
 * A Zalo Official Account conversation, simulated in the browser. It runs the
 * same engine and the same text rendering as the real webhook in
 * examples/zalo-oa-worker; only the transport is replaced.
 */
export default function ZaloPage() {
  const { vertical } = useVertical();
  const [locale, setLocale] = useState<Locale>("vi");
  const [lines, setLines] = useState<Line[]>([]);
  const [session, setSession] = useState<ChatSession>(newSession);
  const [text, setText] = useState("");
  const [lastCall, setLastCall] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const example = locale === "vi" ? vertical.examples[1] : vertical.examples[0];

  useEffect(() => {
    setSession(newSession());
    setLastCall(null);
    setLines([{ from: "oa", text: GREETING[locale](vertical.businessName, example) }]);
  }, [vertical, locale, example]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines.length]);

  async function send(message: string) {
    const msg = message.trim();
    if (!msg) return;
    setText("");
    const result = handleMessage(session, msg, {
      vertical,
      bookings: bookings().list(),
      now: new Date(),
      locale,
      via: "zalo",
    });
    const outgoing = renderText(result.reply, vertical, locale);
    setSession(result.session);
    setLines((l) => [...l, { from: "user", text: msg }, { from: "oa", text: outgoing, options: result.reply.options }]);
    setLastCall(
      JSON.stringify({ recipient: { user_id: "<zalo-user-id>" }, message: { text: outgoing } }, null, 2),
    );

    if (result.booking) {
      const booking = bookings().create(result.booking);
      const serviceName = vertical.services.find((s) => s.id === booking.serviceId)?.name ?? booking.serviceId;
      const deliveries = await dispatch(
        { type: "booking.created", booking, serviceName, businessName: vertical.businessName },
        channelsFor(loadSettings()),
      );
      appendDeliveryLog(booking.id, deliveries);
    }
  }

  const lastOa = lines.findLastIndex((l) => l.from === "oa");

  return (
    <div className="stack">
      <section className="hero">
        <p className="eyebrow">Channel integration</p>
        <h1>Book by chatting on Zalo.</h1>
        <p className="muted lead">
          Customers message the business&apos;s Zalo Official Account the way they already do. The assistant asks for whatever
          is missing and books the slot. This page simulates the chat; the real webhook is in{" "}
          <a href="https://github.com/hoangvanngoc/bookflow/tree/main/examples/zalo-oa-worker">examples/zalo-oa-worker</a>.
        </p>
      </section>

      <div className="zalo-layout">
        <section className="phone" aria-label="Simulated Zalo conversation">
          <header className="zalo-bar">
            <span className="zalo-avatar" aria-hidden="true">
              {vertical.businessName[0]}
            </span>
            <span className="zalo-who">
              <strong>{vertical.businessName}</strong>
              <span>Official Account</span>
            </span>
            <span className="zalo-lang" role="group" aria-label="Language">
              {(["vi", "en"] as const).map((l) => (
                <button key={l} aria-pressed={locale === l} onClick={() => setLocale(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </span>
          </header>

          <div className="zalo-thread" aria-live="polite">
            {lines.map((l, i) => (
              <div key={i} className={`zmsg ${l.from}`}>
                <p>{l.text}</p>
                {i === lastOa && l.options && l.options.length > 0 && (
                  <div className="zquick">
                    {l.options.map((_, j) => (
                      <button key={j} onClick={() => send(String(j + 1))} aria-label={`Reply ${j + 1}`}>
                        {j + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form
            className="zalo-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={locale === "vi" ? "Nhập tin nhắn" : "Type a message"}
              aria-label="Message"
            />
            <button disabled={!text.trim()} aria-label="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10.2 15 12 3.4 13.8z" />
              </svg>
            </button>
          </form>
        </section>

        <aside className="card zalo-side">
          <h2>How it works</h2>
          <ol className="flow">
            <li>
              <strong>Zalo calls the webhook</strong> with a <code>user_send_text</code> event, signed with{" "}
              <code>X-ZEvent-Signature</code>.
            </li>
            <li>
              <strong>The adapter verifies the signature</strong> and loads this customer&apos;s chat session.
            </li>
            <li>
              <strong>The engine plans the reply</strong>: the same parser and follow-up planner as the web assistant, rendered
              as a numbered list because a plain chat has no buttons.
            </li>
            <li>
              <strong>The reply goes out</strong> through the OA customer-service message API. A finished booking is saved and
              shows up in Admin with a Zalo tag.
            </li>
          </ol>
          <h3>Last request to the Zalo OA API</h3>
          <pre className="code">
            {lastCall ? `POST /v3.0/oa/message/cs\naccess_token: <from env>\n\n${lastCall}` : "Send a message to see it."}
          </pre>
          <p className="muted small">
            Try <code>{example}</code>, or leave out the time to see it ask back with numbered choices. Then send a name
            and phone number. Send{" "}
            <code>{locale === "vi" ? "hủy" : "cancel"}</code> to start over.
          </p>
        </aside>
      </div>
    </div>
  );
}
