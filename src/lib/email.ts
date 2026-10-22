import "server-only";
import { Resend } from "resend";

/**
 * Support emails go through Resend. Configure in .env.local:
 *   RESEND_API_KEY      your Resend API key (never commit it)
 *   SUPPORT_EMAIL_TO    who gets support alerts; comma-separate several
 *   SUPPORT_EMAIL_FROM  sender; Resend's test sender until a domain is verified
 * Without a key, emails are skipped and a warning is logged, so tickets still
 * save. Resend's test sender only delivers to your own Resend account email.
 */
const FROM = process.env.SUPPORT_EMAIL_FROM ?? "Dojo Belt Analyzer <onboarding@resend.dev>";
const TO = (process.env.SUPPORT_EMAIL_TO ?? "")
  .split(",")
  .map((address) => address.trim())
  .filter(Boolean);

let client: Resend | null = null;
function resend() {
  if (!process.env.RESEND_API_KEY) return null;
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sends one alert to the support team. Never throws: the ticket is already
 * saved, so a mail hiccup is retried once and then only logged.
 */
export async function sendSupportEmail(subject: string, html: string) {
  const mailer = resend();
  if (!mailer || TO.length === 0) {
    console.warn("Support email skipped: set RESEND_API_KEY and SUPPORT_EMAIL_TO to enable it.");
    return;
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { error } = await mailer.emails.send({ from: FROM, to: TO, subject, html });
      if (!error) return;
      console.error(`Support email failed (attempt ${attempt}):`, error.message);
    } catch (error) {
      console.error(`Support email failed (attempt ${attempt}):`, error);
    }
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 800));
  }
}

/** Email body for a ticket event, in the app's style and plain enough for any inbox. */
export function ticketEmail({
  heading,
  ticketNumber,
  title,
  body,
  meta,
  link,
}: {
  heading: string;
  ticketNumber: number;
  title: string;
  body: string;
  meta: Array<[string, string]>;
  link: string;
}) {
  const rows = meta
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b6966;font-size:13px">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:13px;color:#141414">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f3f1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border:1px solid #e6e3de;border-radius:16px;overflow:hidden">
    <div style="padding:20px 24px;border-bottom:1px solid #eeebe6">
      <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#d32f2e">Kalvium support</div>
      <div style="margin-top:6px;font-size:13px;color:#6b6966">${escapeHtml(heading)} · #${ticketNumber}</div>
      <div style="margin-top:4px;font-size:20px;font-weight:700;color:#141414">${escapeHtml(title)}</div>
    </div>
    <div style="padding:20px 24px">
      <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:#141414">${escapeHtml(body)}</div>
      <table style="margin-top:18px;border-collapse:collapse">${rows}</table>
      <a href="${escapeHtml(link)}" style="display:inline-block;margin-top:20px;background:#141414;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 16px;border-radius:10px">Open ticket</a>
    </div>
  </div></body></html>`;
}
