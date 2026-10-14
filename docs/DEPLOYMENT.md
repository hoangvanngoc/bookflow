# Deployment runbook

How I would take Bookflow from "demo" to "running at a new business". The steps are written so someone on the customer's side can follow them after handover.

## 1. Discovery (day 1)

Questions to answer with the owner before writing any config:

| Topic | Question | Lands in |
| --- | --- | --- |
| Services | What do customers book? How long does each take, including clean-up? | `services[].durationMin` |
| Language | What words do customers actually use in messages? (collect 20 real ones) | `services[].keywords`, parser tests |
| Capacity | How many bookings can run at the same time? What is the bottleneck: rooms, chairs, staff? | `capacity` |
| Hours | Opening days and hours; last booking time | `hours` |
| Channels | Where do bookings arrive today? Where should the owner be notified? | Channels |
| Data | Where must customer data live? Who may see it? | Repository choice |

## 2. Configure (day 1–2)

1. Create `src/verticals/<customer>.json` from the discovery answers.
2. Add the 20 real customer messages as parser test cases. Fix keywords until they pass.
3. `pnpm test && pnpm build`.

## 3. Integrate (day 2–3)

- **Fastest path:** webhook to the automation tool they already use (Zapier, Make, n8n) and let it write to their sheet or chat.
- **Native path:** add a `NotificationChannel` implementation for their system, with a unit test using a mocked `fetch`.
- Check the delivery log in Admin after each test booking.

## 4. Go live

| Check | How |
| --- | --- |
| Tests and build green | CI on the main branch |
| A real booking reaches the owner | Book from a phone, confirm the notification arrives |
| A failing channel does not lose the booking | Point the webhook at a bad URL, book, see the booking saved and the failure logged |
| Owner can read the admin view on their phone | Open `/admin/` at 375 px width |

## 5. Handover

- One-page guide for staff: how to read the admin view, what to do when a notification fails.
- The config file is the only thing they should need to edit for menu or hours changes.
- Agree on who to call and what "urgent" means.

## Hosting this demo

`.github/workflows/pages.yml` builds a static export with `BASE_PATH=/<repo>` and publishes it to GitHub Pages on every push to `main`. Enable it once in **Settings → Pages → Source: GitHub Actions**.
