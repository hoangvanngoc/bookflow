"use client";

import { useEffect, useState } from "react";
import { clearDeliveryLog, readDeliveryLog, type DeliveryLogEntry } from "@/lib/channels/log";
import { defaultSettings, loadSettings, saveSettings, type Settings } from "@/lib/settings";
import { bookings } from "@/lib/store";
import { formatMoney, fromISODate } from "@/lib/time";
import type { Booking } from "@/lib/types";
import { useVertical } from "../providers";

export default function AdminPage() {
  const { vertical } = useVertical();
  const [all, setAll] = useState<Booking[]>([]);
  const [log, setLog] = useState<DeliveryLogEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAll(bookings().list());
    setLog(readDeliveryLog());
    setSettings(loadSettings());
  }, []);

  const mine = all
    .filter((b) => b.verticalId === vertical.id)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const mineIds = new Set(mine.map((b) => b.id));
  const mineLog = log.filter((d) => mineIds.has(d.bookingId));
  const byDate = Object.entries(Object.groupBy(mine, (b) => b.date));
  const revenue = mine.reduce((sum, b) => sum + (vertical.services.find((s) => s.id === b.serviceId)?.price ?? 0), 0);

  function reset() {
    bookings().clear();
    clearDeliveryLog();
    setAll([]);
    setLog([]);
  }

  return (
    <div className="stack">
      <section className="hero">
        <h1>{vertical.businessName} · Admin</h1>
        <p className="muted">Read-only view of bookings made in this browser.</p>
      </section>

      <section className="stats">
        <div className="stat">
          <span className="muted">Bookings</span>
          <strong>{mine.length}</strong>
        </div>
        <div className="stat">
          <span className="muted">Booked value</span>
          <strong>{formatMoney(revenue, vertical.currency, { zeroAsFree: false })}</strong>
        </div>
        <div className="stat">
          <span className="muted">Capacity</span>
          <strong>
            {vertical.capacity} {vertical.providerLabel}s
          </strong>
        </div>
      </section>

      <section className="card">
        <h2>Bookings</h2>
        {byDate.length === 0 && <p className="muted">No bookings yet. Make one on the Book tab.</p>}
        {byDate.map(([date, list]) => (
          <div key={date} className="day">
            <h3>{fromISODate(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h3>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Service</th>
                  <th>Customer</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {list!.map((b) => (
                  <tr key={b.id}>
                    <td>{b.start}</td>
                    <td>{vertical.services.find((s) => s.id === b.serviceId)?.name ?? b.serviceId}</td>
                    <td>
                      {b.customerName}
                      {b.note && <div className="muted small">{b.note}</div>}
                    </td>
                    <td>{b.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Integrations</h2>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            saveSettings(settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
        >
          <label>
            Webhook URL <span className="muted">(get a test one at webhook.site)</span>
            <input
              type="url"
              value={settings.webhookUrl}
              placeholder="https://webhook.site/…"
              onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
            />
          </label>
          <fieldset>
            <legend>Assistant LLM (optional, bring your own key)</legend>
            <label>
              Base URL (OpenAI-compatible)
              <input value={settings.llmBaseUrl} onChange={(e) => setSettings({ ...settings, llmBaseUrl: e.target.value })} />
            </label>
            <label>
              Model
              <input value={settings.llmModel} onChange={(e) => setSettings({ ...settings, llmModel: e.target.value })} />
            </label>
            <label>
              API key <span className="muted">(kept in this tab only, cleared when it closes)</span>
              <input
                type="password"
                autoComplete="off"
                value={settings.llmApiKey}
                onChange={(e) => setSettings({ ...settings, llmApiKey: e.target.value })}
              />
            </label>
          </fieldset>
          <div className="actions">
            <button type="submit" className="primary">
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Delivery log</h2>
        {mineLog.length === 0 ? (
          <p className="muted">Nothing sent yet.</p>
        ) : (
          <ul className="log">
            {mineLog.map((d, i) => (
              <li key={i} data-ok={d.ok}>
                {new Date(d.at).toLocaleTimeString()} · {d.channel} · {d.ok ? "OK" : "Failed"} · {d.detail}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="actions">
        <button className="ghost danger" onClick={reset}>
          Reset demo data
        </button>
      </div>
    </div>
  );
}
