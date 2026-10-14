# Zalo OA webhook (Cloudflare Worker)

Lets customers book by chatting with a business's **Zalo Official Account**. The conversation is the same engine the web demo uses ([`src/lib/conversation/engine.ts`](../../src/lib/conversation/engine.ts)); this folder only wires it to Zalo and storage.

```
Customer on Zalo: "hot stone thứ 7"
OA:  Hot stone massage ngày T7 17/10. Anh/chị muốn mấy giờ ạ?
     1. 09:00
     2. 09:30
     3. 10:00
     ...
     Trả lời bằng số thứ tự để chọn.
Customer: "3"
OA:  Hot stone massage lúc 10:00 ngày T7 17/10 còn trống. Anh/chị gửi giúp mình tên và số điện thoại để giữ chỗ nhé.
Customer: "Lan 0901 234 567"
OA:  Đã đặt xong cho Lan: Hot stone massage lúc 10:00 ngày T7 17/10. Hẹn gặp anh/chị!
```

You can try the same conversation without any account on the demo's **Zalo chat** page.

## What is in here

| File | Role |
| --- | --- |
| `worker.ts` | HTTP entry point, KV storage, secrets from env |
| [`src/lib/channels/zalo/handler.ts`](../../src/lib/channels/zalo/handler.ts) | Verifies the signature, runs the engine, saves the booking, replies. Dependencies injected, fully tested |
| [`src/lib/channels/zalo/signature.ts`](../../src/lib/channels/zalo/signature.ts) | `X-ZEvent-Signature` check (Web Crypto, constant-time compare) |
| [`src/lib/channels/zalo/client.ts`](../../src/lib/channels/zalo/client.ts) | Sends customer-service text messages through the OA API |

## Set up

You need a Zalo OA, a Zalo app linked to it, and a Cloudflare account. No key is stored in this repository.

1. `cp wrangler.toml.example wrangler.toml`, create a KV namespace (`npx wrangler kv namespace create BOOKFLOW_KV`) and paste its id.
2. Set the three secrets with `npx wrangler secret put ...` (names listed in `wrangler.toml.example`).
3. `npx wrangler deploy`, then set the webhook URL in the Zalo app to `https://<your-worker>/zalo/webhook` and enable the `user_send_text` event.
4. Message the OA from a test Zalo account.

## Before real traffic

- Check the signature formula and send endpoint against the current Zalo OA documentation; both are isolated in one file each.
- OA access tokens expire. Add a refresh step (a scheduled Worker that exchanges the refresh token) before running unattended.
- Zalo restricts when an OA may message a user. This adapter only ever replies to an inbound message.
- Move bookings from KV to a database (D1, or the customer's own system) once more than one message per second is possible.
