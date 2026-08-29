import { renderOtpEmail } from "./email-templates.ts";

export type AuthEmailHookPayload = {
  user?: { email?: string; user_metadata?: Record<string, unknown> };
  email_data?: { token?: string; email_action_type?: string };
};

export type AuthEmailMessage = {
  from: string;
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

export type AuthEmailEnvironment = {
  webhookSecret?: string;
  apiKey?: string;
  from?: string;
  replyTo?: string;
};

export type AuthEmailDependencies = {
  verify: (body: string, headers: Record<string, string>, secret: string) => unknown;
  send: (message: AuthEmailMessage, apiKey: string) => Promise<{ ok: boolean; status: number }>;
  info?: (event: string, context: Record<string, string>) => void;
  error?: (event: string) => void;
};

function errorResponse(status: number, message: string) {
  return Response.json({ error: { http_code: status, message } }, { status });
}

export async function handleAuthEmailRequest(request: Request, environment: AuthEmailEnvironment, dependencies: AuthEmailDependencies) {
  if (request.method !== "POST") return errorResponse(405, "Method not allowed.");
  if (!environment.webhookSecret) {
    dependencies.error?.("configuration_missing");
    return errorResponse(500, "Unable to send authentication email.");
  }

  const body = await request.text();
  let payload: AuthEmailHookPayload;
  try {
    payload = dependencies.verify(body, Object.fromEntries(request.headers), environment.webhookSecret) as AuthEmailHookPayload;
  } catch {
    dependencies.error?.("signature_rejected");
    return errorResponse(401, "Invalid webhook signature.");
  }

  const email = payload.user?.email;
  const token = payload.email_data?.token;
  const action = payload.email_data?.email_action_type;
  if (!email || !token || !["signup", "magiclink"].includes(action ?? "")) {
    dependencies.error?.("payload_rejected");
    return errorResponse(400, "Unsupported email hook payload.");
  }
  if (!environment.apiKey || !environment.from) {
    dependencies.error?.("configuration_missing");
    return errorResponse(500, "Unable to send authentication email.");
  }

  const rendered = renderOtpEmail(payload.user?.user_metadata?.preferred_language, token);
  const result = await dependencies.send({
    from: environment.from,
    to: [email],
    replyTo: environment.replyTo,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text
  }, environment.apiKey);
  if (!result.ok) {
    dependencies.error?.("provider_rejected");
    return errorResponse(500, "Unable to send authentication email.");
  }

  dependencies.info?.("email_accepted", { locale: rendered.locale, action: action ?? "unknown" });
  return Response.json({});
}
