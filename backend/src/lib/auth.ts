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

// Access token lifetime. Matches the session cookie's max-age (7d) so a
// fresh login keeps the user signed in for a week without needing a
// refresh round-trip. The 30-day refresh token (random hex stored in DB,
// rotated on use) extends the effective session beyond that and survives
// JWT_SECRET rotation across deploys.
const ACCESS_TOKEN_TTL = "7d";

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
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
