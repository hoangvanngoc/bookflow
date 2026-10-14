/**
 * The slice of the Zalo Official Account webhook payload this adapter reads.
 * Other event types (images, stickers, follow) are acknowledged and ignored.
 */
export type ZaloWebhookEvent = {
  app_id: string;
  event_name: string; // "user_send_text", "follow", ...
  timestamp: string; // ms since epoch, as a string
  sender: { id: string };
  recipient: { id: string };
  message?: { text?: string; msg_id?: string };
};

export type ZaloConfig = {
  appId: string;
  /** OA secret key, used only to verify webhook signatures. From env, never committed. */
  oaSecretKey: string;
  /** OA access token, used to send replies. From env, never committed. */
  accessToken: string;
};
