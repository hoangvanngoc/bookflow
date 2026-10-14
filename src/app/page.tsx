"use client";

import { useEffect, useMemo, useState } from "react";
import type { Service } from "@/verticals";
import { parseWithLlm } from "@/lib/assistant/llm";
import { channelsFor, dispatch, type DeliveryResult } from "@/lib/channels";
import { appendDeliveryLog } from "@/lib/channels/log";
import { loadSettings } from "@/lib/settings";
import { availableSlots, isOpenOn } from "@/lib/slots";
import { bookings } from "@/lib/store";
import { addDays, formatMoney, fromISODate, toISODate } from "@/lib/time";
import type { Booking } from "@/lib/types";
import { useVertical } from "./providers";

type Step = "service" | "time" | "details" | "done";
const DAYS_AHEAD = 14;

export default function BookPage() {
  const { vertical } = useVertical();
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [time, setTime] = useState<string | null>(null);
  const [existing, setExisting] = useState<Booking[]>([]);
  const [confirmed, setConfirmed] = useState<{ booking: Booking; deliveries: DeliveryResult[] } | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  // Switching deployment starts the flow over.
  useEffect(() => {
    setStep("service");
    setService(null);
    setTime(null);
    setHint(null);
    setExisting(bookings().list());
  }, [vertical.id]);

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => toISODate(addDays(today, i)));
  }, []);

  const slots = useMemo(
    () => (service ? availableSlots(vertical, service, date, existing) : []),
    [vertical, service, date, existing],
  );

  function firstDayWithSlots(s: Service): string {
    return days.find((d) => availableSlots(vertical, s, d, existing).length > 0) ?? days[0];
  }

  async function applyAssistant(text: string) {
    const s = loadSettings();
    const parsed = await parseWithLlm(text, vertical, new Date(), {
      baseUrl: s.llmBaseUrl,
      model: s.llmModel,
      apiKey: s.llmApiKey,
    });
    const svc = vertical.services.find((x) => x.id === parsed.serviceId) ?? null;
    const notes: string[] = [];
    if (!svc) {
      setHint("Couldn't tell which service you mean. Pick one below.");
      setStep("service");
      return;
    }
    setService(svc);
    const d = parsed.date ?? toISODate(new Date());
    setDate(d);
    const open = availableSlots(vertical, svc, d, existing);
    if (parsed.time && open.includes(parsed.time)) {
      setTime(parsed.time);
      setStep("details");
    } else {
      setTime(null);
      setStep("time");
      if (!isOpenOn(vertical, d)) notes.push("We're closed that day.");
      else if (parsed.time) notes.push(`${parsed.time} isn't available.`);
      notes.push("Choose a time below.");
    }
    setHint(`Understood (${parsed.source}): ${svc.name}, ${prettyDate(d)}${parsed.time ? `, ${parsed.time}` : ""}. ${notes.join(" ")}`);
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
    setHint(null);
    setConfirmed(null);
  }

  return (
    <div className="stack">
      <section className="hero">
        <h1>{vertical.businessName}</h1>
        <p className="muted">{vertical.tagline}</p>
      </section>

      {step !== "done" && (
        <Assistant
          onSubmit={applyAssistant}
          example={`${vertical.services[0].keywords[0]} tomorrow 3pm`}
        />
      )}
      {hint && step !== "done" && <p className="hint">{hint}</p>}

      {step !== "done" && <Steps step={step} />}

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
                    setStep("time");
                  }}
                >
                  <span>{s.name}</span>
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
        <section className="card">
          <h2>Your details</h2>
          <p className="muted">
            {service.name} · {prettyDate(date)} at {time}
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
              Note <span className="muted">(optional)</span>
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

      {step === "done" && confirmed && service && (
        <section className="card">
          <h2>Booked</h2>
          <p>
            {confirmed.booking.customerName}, see you {prettyDate(confirmed.booking.date)} at {confirmed.booking.start} for{" "}
            {service.name}.
          </p>
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
      )}
    </div>
  );
}

function Assistant({ onSubmit, example }: { onSubmit: (text: string) => Promise<void>; example: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="assistant"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        await onSubmit(text);
        setBusy(false);
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Describe it, e.g. "${example}"`}
        aria-label="Describe your booking"
      />
      <button className="primary" disabled={busy}>
        {busy ? "Reading…" : "Fill in"}
      </button>
    </form>
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
          {l}
        </li>
      ))}
    </ol>
  );
}

function prettyDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
