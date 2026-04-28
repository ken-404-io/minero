import crypto from "node:crypto";
import { prisma } from "./db.js";
import { getConfig } from "./config.js";
import { enqueue, QUEUE_EMAIL, QUEUE_SMS } from "./queue.js";
import { smsProvider } from "./sms.js";
import { passwordResetHtml } from "./email.js";

export type OtpPurpose = "withdraw" | "login" | "change_password" | "password_reset";

// Destination channel. Email lands in the inbox via the email provider;
// sms goes through one of the SMS providers (see sms.ts).
export type OtpChannel = "sms" | "email" | "console";

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
    const isReset = params.purpose === "password_reset";
    await enqueue(QUEUE_EMAIL, {
      to: params.destination,
      subject: isReset
        ? "Reset your Minero password"
        : `Your Minero verification code: ${code}`,
      html: isReset
        ? passwordResetHtml({ code, ttlMinutes })
        : otpEmailHtml(code, ttlMinutes),
    });
  } else {
    await enqueue(QUEUE_SMS, {
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
