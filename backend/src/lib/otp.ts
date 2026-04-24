import crypto from "node:crypto";
import { prisma } from "./db.js";
import { getConfig } from "./config.js";

export type OtpPurpose = "withdraw" | "login" | "change_password";

// SMS provider interface. Real providers (Twilio, Semaphore, Movider)
// implement send() with their SDK. Dev provider logs to console.

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

export const smsProvider: SmsProvider = new ConsoleSmsProvider();

function generateCode(digits: number): string {
  const max = 10 ** digits;
  return crypto.randomInt(0, max).toString().padStart(digits, "0");
}

export async function issueOtp(params: {
  userId: string;
  purpose: OtpPurpose;
  destination: string;
}) {
  const cfg = await getConfig();
  const code = generateCode(cfg.otpDigits);
  const expiresAt = new Date(Date.now() + cfg.otpTtlMs);

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
      channel: smsProvider.name,
      expiresAt,
    },
  });

  await smsProvider.send({
    to: params.destination,
    message: `Your Minero verification code is ${code}. Expires in ${Math.floor(cfg.otpTtlMs / 60000)} minutes.`,
  });

  return { expiresAt };
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
