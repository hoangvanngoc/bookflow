# Architecture

```
            ┌──────────────────────────── browser ────────────────────────────┐
 customer   │  Book page ──► Assistant ──► parse.ts (rules) ──► llm.ts (BYO)  │
  message ─►│     │              ▲                 │                          │
            │     │              └── follow-up ◄── reply.ts (planReply)       │
            │     ├──► slots.ts  ◄── verticals/*.json  (hours, capacity, ...) │
            │     │                                                           │
            │     ├──► BookingRepository ──► localStorage                     │
            │     │                                                           │
            │     └──► dispatch() ──► ConsoleChannel                          │
            │                    └──► WebhookChannel ──────────────────────────┼──► Zapier / n8n /
            │  Admin page ◄── repository + delivery log                       │    customer API
            └─────────────────────────────────────────────────────────────────┘
```

## Layers

| Layer | Files | Swap point for a real deployment |
| --- | --- | --- |
| Configuration | `src/verticals/` | One JSON per customer. Could move to a database or a CMS without touching the UI. |
| Domain logic | `src/lib/slots.ts`, `src/lib/time.ts` | Pure functions, fully unit-tested. |
| Input understanding | `src/lib/assistant/parse.ts`, `llm.ts` | Rules first, LLM optional. Output is always validated against the catalogue. |
| Conversation | `src/lib/assistant/reply.ts` | Decides the next follow-up from a partial request. Pure function; a chat-app adapter could reuse it as is. |
| Persistence | `src/lib/store.ts` | `BookingRepository` interface; replace `LocalBookingRepository` with an API client. |
| Integrations | `src/lib/channels/` | `NotificationChannel` interface; add a class per customer system. |
| UI | `src/app/` | Two screens. Reads config through `useVertical()`. |

## Decisions

- **Static export, no backend.** The demo has to be free to host and impossible to abuse. Each visitor gets a private sandbox in their own browser.
- **Rules before LLM.** A booking assistant that needs a paid API to work at all is a hard sell to a small business. The parser covers the common phrasings in two languages; the LLM is an upgrade path, not a dependency.
- **Ask, don't fail.** An incomplete message is the normal case, not an error. The planner always answers with something the customer can tap, and merges later replies into what it already knows.
- **Never trust model output.** The LLM may only choose a service id that exists, a valid date and a valid time. Anything else falls back to the rule result.
- **Conservative capacity check.** Counting every overlapping booking can reject a slot that would technically fit. It can never double-book, which is the failure customers actually complain about.
- **Fan-out with `allSettled`.** The booking is the source of truth; notifications are best-effort and observable in the delivery log.
