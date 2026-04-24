import crypto from "node:crypto";
import { prisma } from "./db.js";
import { getConfig } from "./config.js";
import { emailProvider } from "./email.js";

export type OtpPurpose = "withdraw" | "login" | "change_password";

// Destination channel. Email lands in the inbox via the email provider;
// sms goes through one of the SMS providers below.
export type OtpChannel = "sms" | "email" | "console";

// ── SMS provider interface ──────────────────────────────────────────────────
// Real providers implement send() against their HTTP API. The dev/default
// provider logs to console so local development doesn't require credentials.

export interface SmsProvider {
  readonly name: string;
  send(input: { to: string; message: string }): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async send(input: { to: string; message: string }) {
    // eslint-disable-next-line no-console
    console.log(`[otp:sms ${this.name}] → ${input.to}: ${input.message}`);
  }
}

// Semaphore — https://semaphore.co/. Cheapest SMS for Philippine numbers.
// POST https://api.semaphore.co/api/v4/messages with apikey, number, message, sendername.
class SemaphoreSmsProvider implements SmsProvider {
  readonly name = "semaphore";
  constructor(
    private readonly apiKey: string,
    private readonly senderName: string,
  ) {}

  async send(input: { to: string; message: string }) {
    // Semaphore accepts "09XXXXXXXXX" (PH mobile) directly.
    const params = new URLSearchParams({
      apikey: this.apiKey,
      number: input.to,
      message: input.message,
      sendername: this.senderName,
    });
    const res = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[otp:sms semaphore] error", res.status, text);
      throw new Error(`Semaphore send failed: ${res.status}`);
    }
  }
}

// Twilio — https://www.twilio.com/. Global fallback.
// POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json with Basic auth.
class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
  ) {}

  async send(input: { to: string; message: string }) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const params = new URLSearchParams({
      To: toE164(input.to),
      From: this.from,
      Body: input.message,
    });
    const basic = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[otp:sms twilio] error", res.status, text);
      throw new Error(`Twilio send failed: ${res.status}`);
    }
  }
}

// PH-local 09XXXXXXXXX → +639XXXXXXXXX. Twilio needs E.164.
function toE164(ph: string): string {
  const trimmed = ph.replace(/\s+/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("09") && trimmed.length === 11) {
    return `+63${trimmed.slice(1)}`;
  }
  return trimmed;
}

function createSmsProvider(): SmsProvider {
  const provider = (process.env.SMS_PROVIDER ?? "").toLowerCase();

  if (provider === "semaphore" && process.env.SEMAPHORE_API_KEY) {
    return new SemaphoreSmsProvider(
      process.env.SEMAPHORE_API_KEY,
      process.env.SEMAPHORE_SENDER_NAME ?? "MINERO",
    );
  }

  if (
    provider === "twilio" &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  ) {
    return new TwilioSmsProvider(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
      process.env.TWILIO_FROM,
    );
  }

  // Auto-detect: if Semaphore credentials are set and no provider was chosen.
  if (!provider && process.env.SEMAPHORE_API_KEY) {
    return new SemaphoreSmsProvider(
      process.env.SEMAPHORE_API_KEY,
      process.env.SEMAPHORE_SENDER_NAME ?? "MINERO",
    );
  }

  return new ConsoleSmsProvider();
}

export const smsProvider: SmsProvider = createSmsProvider();

// ── OTP issue / verify ──────────────────────────────────────────────────────

function generateCode(digits: number): string {
  const max = 10 ** digits;
  return crypto.randomInt(0, max).toString().padStart(digits, "0");
}

function looksLikeEmail(d: string): boolean {
  return d.includes("@") && d.includes(".");
}

function otpEmailHtml(code: string, ttlMinutes: number): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#111">
<h2 style="color:#16a34a">Your verification code</h2>
<p>Use this code to continue:</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:700;font-family:ui-monospace,Menlo,monospace;background:#f3f4f6;padding:12px 16px;border-radius:8px;display:inline-block">${code}</p>
<p style="color:#6b7280">This code expires in ${ttlMinutes} minute${ttlMinutes === 1 ? "" : "s"}. If you didn't request it, you can safely ignore this message.</p>
<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb"/>
<p style="color:#6b7280;font-size:13px">— The Minero Team</p>
</body></html>`;
}

export async function issueOtp(params: {
  userId: string;
  purpose: OtpPurpose;
  destination: string;
}) {
  const cfg = await getConfig();
  const code = generateCode(cfg.otpDigits);
  const expiresAt = new Date(Date.now() + cfg.otpTtlMs);
  const ttlMinutes = Math.floor(cfg.otpTtlMs / 60_000);

  // Route by destination shape: email → email provider, phone → SMS provider.
  const channel: OtpChannel = looksLikeEmail(params.destination)
    ? "email"
    : (smsProvider.name === "console" ? "console" : "sms");

  // Invalidate any existing codes for same user+purpose so only the latest works.
  await prisma.otpCode.updateMany({
    where: { userId: params.userId, purpose: params.purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.otpCode.create({
    data: {
      userId: params.userId,
      purpose: params.purpose,
      code,
      channel,
      expiresAt,
    },
  });

  if (channel === "email") {
    await emailProvider.send({
      to: params.destination,
      subject: `Your Minero verification code: ${code}`,
      html: otpEmailHtml(code, ttlMinutes),
    });
  } else {
    await smsProvider.send({
      to: params.destination,
      message: `Your Minero verification code is ${code}. Expires in ${ttlMinutes} minutes.`,
    });
  }

  return { expiresAt, channel };
}

export async function verifyOtp(params: {
  userId: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const row = await prisma.otpCode.findFirst({
    where: { userId: params.userId, purpose: params.purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, reason: "no_code" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  // Constant-time comparison prevents timing-based enumeration of OTP codes.
  const expected = Buffer.from(row.code, "utf8");
  const provided = Buffer.from(params.code, "utf8");
  const codeOk =
    expected.length === provided.length &&
    crypto.timingSafeEqual(expected, provided);
  if (!codeOk) return { ok: false, reason: "mismatch" };

  await prisma.otpCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return { ok: true };
}
