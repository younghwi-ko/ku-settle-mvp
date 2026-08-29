export type EmailLocale = "en" | "ko" | "ja" | "zh-CN";
export function normalizeEmailLocale(value: unknown): EmailLocale { return value === "ko" || value === "ja" || value === "zh-CN" ? value : "en"; }

const copy = {
  en: { subject: "Your KU Settle verification code", intro: "Use this code to continue to KU Settle.", expiry: "This code expires in 10 minutes.", security: "If you did not request this code, you can safely ignore this email." },
  ko: { subject: "KU Settle 인증 코드", intro: "KU Settle을 계속 이용하려면 아래 코드를 입력하세요.", expiry: "이 코드는 10분 후 만료됩니다.", security: "직접 요청하지 않았다면 이 이메일을 무시해도 됩니다." },
  ja: { subject: "KU Settle 認証コード", intro: "KU Settleを続けるには、以下のコードを入力してください。", expiry: "このコードは10分後に期限切れになります。", security: "このコードをリクエストしていない場合は、このメールを無視してください。" },
  "zh-CN": { subject: "KU Settle 验证码", intro: "请输入以下验证码以继续使用 KU Settle。", expiry: "此验证码将在10分钟后失效。", security: "如果这不是您本人发起的请求，请忽略此邮件。" }
} as const;

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character); }

export function renderOtpEmail(localeValue: unknown, token: string) {
  const locale = normalizeEmailLocale(localeValue); const value = copy[locale]; const safeToken = escapeHtml(token);
  const text = `KU Settle\n\n${value.intro}\n\n${token}\n\n${value.expiry}\n${value.security}`;
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f5f7fa;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#18212f"><div style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border-radius:16px"><div style="font-weight:800;color:#7a1730">KU Settle</div><p>${value.intro}</p><div style="font-size:32px;letter-spacing:8px;font-weight:800;padding:20px;background:#f3f0f1;text-align:center;border-radius:12px">${safeToken}</div><p>${value.expiry}</p><p style="color:#667085;font-size:13px">${value.security}</p></div></body></html>`;
  return { locale, subject: value.subject, text, html };
}
