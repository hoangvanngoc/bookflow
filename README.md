# Bookflow

A small, config-driven booking app for appointment-based service businesses: spas, clinics, salons.

**Live demo:** https://hoangvanngoc.github.io/bookflow/ (everything runs in your browser; no account, no backend)

**Full product:** Bookflow is a simplified, open-source take on the booking product I work on: [bookapp.yeowubie.com](https://bookapp.yeowubie.com/landing). None of that product's code is in this repository.

Bookflow is a deliberately small codebase that shows how I approach **forward deployment**: take one product, fit it to a specific business quickly, plug it into the tools that business already uses, and leave behind something the customer's team can operate.

<p>
  <img src="docs/screenshot-admin.png" alt="Admin view: bookings, integrations and delivery log" width="62%">
  <img src="docs/screenshot-mobile.png" alt="Choosing a time on a phone" width="30%">
</p>

> This is a showcase project with fictional businesses and data. It is not a production system: there is no auth, no server-side storage, and no payment handling.

## What it does

- **Booking flow**: pick a service, a day and a free time, enter name and phone, confirm.
- **Admin view**: bookings grouped by day, booked value, and a log of every notification sent.
- **Three deployments from one build**: switch between a spa, a dental clinic and a hair salon in the header. Each one is a single JSON file.
- **Text assistant**: type `massage tomorrow 3pm` or `mai 3h chiều massage chân` and the form fills itself. Rule-based by default (English and Vietnamese), with an optional LLM path if you bring your own key.
- **Integrations**: every booking is fanned out to notification channels. The demo ships a console channel and a generic webhook; point it at [webhook.site](https://webhook.site) to watch the payload arrive.

## Why it is built this way

| Customer-deployment problem | How the code handles it |
| --- | --- |
| Every business is different (hours, services, capacity, words customers use) | [`src/verticals/*.json`](src/verticals) holds everything that varies. Onboarding a business is a config file, not a fork. |
| Every business already has tools (a chat app, a CRM, a spreadsheet) | [`NotificationChannel`](src/lib/channels/types.ts) is a one-method interface. The [webhook adapter](src/lib/channels/webhook.ts) covers Zapier, Make, n8n or a custom endpoint on day one. |
| One broken integration must not lose a booking | [`dispatch`](src/lib/channels/index.ts) uses `Promise.allSettled`; failures are logged, the booking stands. |
| Storage depends on the customer's stack | UI talks to a [`BookingRepository`](src/lib/store.ts) interface. The demo uses browser storage; a real deployment swaps in its backend. |
| Customers write in their own language and shorthand | [Rule parser](src/lib/assistant/parse.ts) first: offline, free, predictable. [LLM](src/lib/assistant/llm.ts) only as an upgrade, and its output is validated against the real catalogue before use. |
| No double bookings, ever | [`availableSlots`](src/lib/slots.ts) counts overlapping bookings against capacity, conservatively. |

More on this in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), the onboarding runbook in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), and the reasoning behind the scope in [docs/CASE_STUDY.md](docs/CASE_STUDY.md).

## Run it

Requires Node.js 22+ and pnpm (`corepack enable`).

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # slot logic, parser (EN + VI), LLM validation, channels
pnpm build        # static export to ./out
```

## Onboard a new business in five minutes

1. Copy [`src/verticals/spa.json`](src/verticals/spa.json) to `src/verticals/yoga.json` and edit the name, hours, capacity, services and keywords.
2. Register it in [`src/verticals/index.ts`](src/verticals/index.ts).
3. `pnpm test && pnpm build`. It appears in the deployment switcher.

## Try the LLM assistant

Open **Admin → Integrations**, set any OpenAI-compatible base URL, model and **your own** API key. The key stays in `sessionStorage` for that tab only. Neither this repo nor the hosted demo contains a key.

## Tech

Next.js 16 (static export) · React 19 · TypeScript · Vitest · GitHub Actions · GitHub Pages. No runtime dependencies beyond React and Next.

## License

[MIT](LICENSE)
