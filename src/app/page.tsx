"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Service } from "@/verticals";
import { parseWithLlm } from "@/lib/assistant/llm";
import { planReply, type Partial } from "@/lib/assistant/reply";
import { channelsFor, dispatch, type DeliveryResult } from "@/lib/channels";
import { appendDeliveryLog } from "@/lib/channels/log";
import { loadSettings } from "@/lib/settings";
import { availableSlots, isOpenOn } from "@/lib/slots";
import { bookings } from "@/lib/store";
import { addDays, formatMoney, fromISODate, toISODate } from "@/lib/time";
import type { Booking } from "@/lib/types";
import { useVertical } from "./providers";

type Step = "service" | "time" | "details" | "done";
type Option = { kind: "service"; id: string } | { kind: "date"; date: string } | { kind: "time"; time: string };
type Message = { role: "user" | "assistant"; text: string; options?: Option[]; source?: "rules" | "llm" };

const DAYS_AHEAD = 14;
const EMPTY: Partial = { serviceId: null, date: null, time: null };

export default function BookPage() {
  const { vertical } = useVertical();
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [time, setTime] = useState<string | null>(null);
  const [via, setVia] = useState<"assistant" | "form">("form");
  const [existing, setExisting] = useState<Booking[]>([]);
  const [confirmed, setConfirmed] = useState<{ booking: Booking; deliveries: DeliveryResult[] } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState<Partial>(EMPTY);
  const [mode, setMode] = useState("Offline rules");
  const formRef = useRef<HTMLDivElement>(null);

  // Switching deployment starts everything over.
  useEffect(() => {
    restart();
    setExisting(bookings().list());
    const s = loadSettings();
    setMode(s.llmApiKey ? `LLM · ${s.llmModel}` : "Offline rules");
  }, [vertical.id]);

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => toISODate(addDays(today, i)));
  }, []);

  const slots = useMemo(
    () => (service ? availableSlots(vertical, service, date, existing) : []),
    [vertical, service, date, existing],
  );

  const serviceName = (id: string) => vertical.services.find((s) => s.id === id)?.name ?? id;

  function optionLabel(o: Option): string {
    if (o.kind === "service") return serviceName(o.id);
    if (o.kind === "date") return prettyDate(o.date);
    return o.time;
  }

  /** Ask the planner what to say next, sync the manual form, and post the reply. */
  function respond(next: Partial, source?: "rules" | "llm") {
    const r = planReply(next, vertical, existing, new Date());
    setDraft("date" in r ? { ...next, date: r.date } : next);
    let reply: Message;

    if (r.kind === "ask-service") {
      reply = {
        role: "assistant",
        text: "Which service would you like?",
        options: vertical.services.map((s) => ({ kind: "service", id: s.id })),
      };
    } else {
      const svc = vertical.services.find((s) => s.id === r.serviceId)!;
      setService(svc);
      setVia("assistant");
      if (r.kind === "ready") {
        setDate(r.date);
        setTime(r.time);
        setStep("details");
        reply = {
          role: "assistant",
          text: `${svc.name}, ${prettyDate(r.date)} at ${r.time} is free. Add your name and phone below to confirm.`,
        };
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      } else if (r.kind === "ask-date") {
        setTime(null);
        setStep("time");
        const why = r.reason === "closed" ? `We're closed on ${prettyDate(r.requested)}.` : `${prettyDate(r.requested)} is fully booked.`;
        reply = {
          role: "assistant",
          text: r.options.length ? `${why} These days have room:` : `${why} Nothing free in the next two weeks.`,
          options: r.options.map((d) => ({ kind: "date", date: d })),
        };
      } else {
        setDate(r.date);
        setTime(null);
        setStep("time");
        const day = prettyDate(r.date);
        const text = !r.options.length
          ? `Nothing free on ${day}.`
          : r.requested
            ? `${r.requested} is taken on ${day}. Closest free times:`
            : `${svc.name} on ${day}. What time suits you?`;
        reply = { role: "assistant", text, options: r.options.map((t) => ({ kind: "time", time: t })) };
      }
    }
    setMessages((m) => [...m, { ...reply, source }]);
  }

  async function ask(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
    const s = loadSettings();
    const parsed = await parseWithLlm(text, vertical, new Date(), {
      baseUrl: s.llmBaseUrl,
      model: s.llmModel,
      apiKey: s.llmApiKey,
    });
    // A follow-up message only overrides what it actually mentions.
    respond(
      {
        serviceId: parsed.serviceId ?? draft.serviceId,
        date: parsed.date ?? draft.date,
        time: parsed.time ?? draft.time,
      },
      parsed.source,
    );
  }

  function pick(o: Option) {
    setMessages((m) => [...m, { role: "user", text: optionLabel(o) }]);
    if (o.kind === "service") respond({ ...draft, serviceId: o.id });
    if (o.kind === "date") respond({ ...draft, date: o.date });
    if (o.kind === "time") respond({ ...draft, time: o.time });
  }

  async function submit(form: FormData) {
    if (!service || !time) return;
    const booking = bookings().create({
      verticalId: vertical.id,
      serviceId: service.id,
      date,
      start: time,
      customerName: String(form.get("name") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      note: String(form.get("note") ?? "").trim(),
      via,
    });
    setExisting(bookings().list());
    const deliveries = await dispatch(
      { type: "booking.created", booking, serviceName: service.name, businessName: vertical.businessName },
      channelsFor(loadSettings()),
    );
    appendDeliveryLog(booking.id, deliveries);
    setConfirmed({ booking, deliveries });
    setStep("done");
  }

  function restart() {
    setStep("service");
    setService(null);
    setTime(null);
    setVia("form");
    setConfirmed(null);
    setMessages([]);
    setDraft(EMPTY);
  }

  function firstDayWithSlots(s: Service): string {
    return days.find((d) => availableSlots(vertical, s, d, existing).length > 0) ?? days[0];
  }

  if (step === "done" && confirmed && service) {
    return (
      <div className="stack">
        <section className="card done">
          <p className="eyebrow">Booking confirmed</p>
          <h1>See you soon, {confirmed.booking.customerName}.</h1>
          <dl className="summary">
            <div>
              <dt>Service</dt>
              <dd>{service.name}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>
                {prettyDate(confirmed.booking.date)} at {confirmed.booking.start}
              </dd>
            </div>
            <div>
              <dt>Booked via</dt>
              <dd>{via === "assistant" ? "AI assistant" : "Booking form"}</dd>
            </div>
          </dl>
          <h3>Notifications sent</h3>
          <ul className="log">
            {confirmed.deliveries.map((d) => (
              <li key={d.channel} data-ok={d.ok}>
                {d.ok ? "OK" : "Failed"} · {d.channel} · {d.detail}
              </li>
            ))}
          </ul>
          <div className="actions">
            <button className="primary" onClick={restart}>
              Book another
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="hero">
        <p className="eyebrow">{vertical.businessName}</p>
        <h1>{vertical.tagline}</h1>
      </section>

      <AssistantPanel
        mode={mode}
        examples={vertical.examples}
        messages={messages}
        optionLabel={optionLabel}
        onAsk={ask}
        onPick={pick}
        onReset={() => {
          setMessages([]);
          setDraft(EMPTY);
        }}
      />

      <p className="divider">
        <span>or book step by step</span>
      </p>

      <Steps step={step} />

      {step === "service" && (
        <section className="card">
          <h2>Choose a service</h2>
          <ul className="list">
            {vertical.services.map((s) => (
              <li key={s.id}>
                <button
                  className="row"
                  onClick={() => {
                    setService(s);
                    setDate(firstDayWithSlots(s));
                    setTime(null);
                    setVia("form");
                    setStep("time");
                  }}
                >
                  <span className="row-title">{s.name}</span>
                  <span className="muted">
                    {s.durationMin} min · {formatMoney(s.price, vertical.currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === "time" && service && (
        <section className="card">
          <h2>{service.name}</h2>
          <div className="chips" role="listbox" aria-label="Date">
            {days.map((d) => (
              <button
                key={d}
                className="chip"
                aria-selected={d === date}
                disabled={!isOpenOn(vertical, d)}
                onClick={() => {
                  setDate(d);
                  setTime(null);
                }}
              >
                {prettyDate(d)}
              </button>
            ))}
          </div>
          {slots.length === 0 ? (
            <p className="muted">No free times on this day.</p>
          ) : (
            <div className="grid" role="listbox" aria-label="Time">
              {slots.map((t) => (
                <button key={t} className="chip" aria-selected={t === time} onClick={() => setTime(t)}>
                  {t}
                </button>
              ))}
            </div>
          )}
          <div className="actions">
            <button className="ghost" onClick={() => setStep("service")}>
              Back
            </button>
            <button className="primary" disabled={!time} onClick={() => setStep("details")}>
              Continue
            </button>
          </div>
        </section>
      )}

      {step === "details" && service && time && (
        <section className="card" ref={formRef}>
          <h2>Your details</h2>
          <p className="muted">
            {service.name} · {prettyDate(date)} at {time}
            {via === "assistant" && <span className="tag">Filled by AI</span>}
          </p>
          <form action={submit} className="form">
            <label>
              Name
              <input name="name" required autoComplete="name" />
            </label>
            <label>
              Phone
              <input name="phone" required type="tel" autoComplete="tel" pattern="[0-9+ ]{8,15}" />
            </label>
            <label>
              <span>
                Note <span className="muted">(optional)</span>
              </span>
              <textarea name="note" rows={2} />
            </label>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setStep("time")}>
                Back
              </button>
              <button type="submit" className="primary">
                Confirm booking
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

function AssistantPanel(props: {
  mode: string;
  examples: string[];
  messages: Message[];
  optionLabel: (o: Option) => string;
  onAsk: (text: string) => Promise<void>;
  onPick: (o: Option) => void;
  onReset: () => void;
}) {
  const { mode, examples, messages, optionLabel, onAsk, onPick, onReset } = props;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const lastAssistant = messages.findLastIndex((m) => m.role === "assistant");

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send(value: string) {
    if (!value.trim() || busy) return;
    setText("");
    setBusy(true);
    await onAsk(value.trim());
    setBusy(false);
  }

  return (
    <section className="ai" aria-label="AI booking assistant">
      <div className="ai-head">
        <p className="ai-eyebrow">
          <SparkIcon /> AI booking assistant
        </p>
        <span className="ai-mode" title="Set an LLM key in Admin to switch modes">
          {mode}
        </span>
      </div>
      <h2 className="ai-title">Tell us what you need, in your own words.</h2>

      {messages.length > 0 && (
        <div className="thread" ref={threadRef} aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              <p>{m.text}</p>
              {m.source && <span className="bubble-meta">{m.source === "llm" ? "Read by LLM" : "Read by rules"}</span>}
              {m.options && m.options.length > 0 && (
                <div className="bubble-options">
                  {m.options.map((o, j) => (
                    <button key={j} className="option" disabled={i !== lastAssistant} onClick={() => onPick(o)}>
                      {optionLabel(o)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="bubble assistant typing">Reading your message…</div>}
        </div>
      )}

      <form
        className="ai-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={messages.length ? "Type a reply…" : "Type what you need…"}
          aria-label="Message the booking assistant"
        />
        <button className="primary" disabled={busy || !text.trim()}>
          Send
        </button>
      </form>

      <div className="ai-foot">
        {messages.length === 0 ? (
          <>
            <span className="ai-try">Try</span>
            {examples.map((ex) => (
              <button key={ex} className="example" onClick={() => send(ex)}>
                {ex}
              </button>
            ))}
          </>
        ) : (
          <button className="example" onClick={onReset}>
            Start over
          </button>
        )}
      </div>
    </section>
  );
}

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm7 12l.95 2.55L22.5 17.5l-2.55.95L19 21l-.95-2.55L15.5 17.5l2.55-.95L19 14z"
      />
    </svg>
  );
}

function Steps({ step }: { step: Step }) {
  const order: Step[] = ["service", "time", "details"];
  const labels = ["Service", "Time", "Details"];
  const current = order.indexOf(step);
  return (
    <ol className="steps">
      {labels.map((l, i) => (
        <li key={l} data-state={i < current ? "done" : i === current ? "current" : "todo"}>
          <span className="step-num">{i + 1}</span>
          {l}
        </li>
      ))}
    </ol>
  );
}

function prettyDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
