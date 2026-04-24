import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const secretString = process.env.JWT_SECRET;
if (!secretString || secretString.length < 32) {
  throw new Error("JWT_SECRET must be set to at least 32 characters");
}
const SECRET = new TextEncoder().encode(secretString);

export type SessionPayload = {
  userId: string;
  role: string;
};

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function generateReferralCode(): string {
  // 4 crypto-random bytes → 8 uppercase hex chars (~4 billion combinations).
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}
