import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { handleAuthEmailRequest } from "../_shared/send-email-handler.ts";

Deno.serve((request) => handleAuthEmailRequest(request, {
  webhookSecret: Deno.env.get("SEND_EMAIL_HOOK_SECRET"),
  apiKey: Deno.env.get("RESEND_API_KEY"),
  from: Deno.env.get("AUTH_EMAIL_FROM"),
  replyTo: Deno.env.get("AUTH_EMAIL_REPLY_TO")
}, {
  verify: (body, headers, secret) => new Webhook(secret).verify(body, headers),
  send: async (message, apiKey) => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: message.from, to: message.to, reply_to: message.replyTo, subject: message.subject, html: message.html, text: message.text })
  }),
  info: (event, context) => console.info(`Auth email ${event}`, context),
  error: (event) => console.error(`Auth email ${event}`)
}));
