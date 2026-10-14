# Case study: scoping a booking product for small service businesses

> The businesses in this repository are fictional. This write-up describes the problem space and the trade-offs behind the design, not a specific client.

## The problem

Small appointment businesses (spas, massage shops, clinics, salons) take most bookings through chat apps and phone calls. A typical day looks like this:

- Messages arrive in several apps, often in shorthand and mixed languages ("mai 3h chiều massage chân").
- Staff check a paper book or a shared sheet, reply by hand, and sometimes double-book.
- The owner has no single view of the day.

Off-the-shelf booking platforms exist, but they assume customers will visit a booking page. In practice customers send a message and expect a reply.

## What mattered most

1. **Never double-book.** One double booking costs more goodwill than a dozen fast replies earn.
2. **Meet customers where they write.** Understand short messages in the local language, without making the owner pay for an AI API on day one.
3. **Fit the business, not the other way round.** Hours, capacity and services differ a lot between a spa, a clinic and a salon.
4. **Plug into what already exists.** Owners will not move to a new inbox; the booking has to reach the tools they already watch.

## Design response

| Need | Choice | Trade-off accepted |
| --- | --- | --- |
| No double booking | Conservative overlap count against capacity | Occasionally hides a slot that would fit |
| Local-language messages | Rule-based parser for EN + VI, LLM as optional upgrade | Rules miss unusual phrasings; the form is the fallback |
| Different businesses | One JSON config per business | Logic that truly differs (deposits, staff preferences) would need code |
| Existing tools | Webhook first, native adapters later | Webhook delivery is best-effort; failures are logged, not retried |

## What I deliberately left out

Authentication, payments, staff scheduling, reminders, multi-location. Each is real work in production, and none of them changes the core question this project answers: *can one product be fitted to a new business in a day?*

## What I would do next in a real deployment

1. Collect 50 real customer messages and grow the parser test suite from them.
2. Move storage to a server-side repository with per-business access control.
3. Add retries with backoff and an outbox for channels.
4. Add a native adapter for the chat app the business uses most.
5. Measure: share of bookings created from messages without staff typing anything.
