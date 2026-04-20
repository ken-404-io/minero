import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/backend/lib/db";
import { createSession, generateReferralCode } from "@/backend/lib/auth";
import { cookies } from "next/headers";

const schema = z.object({
  name: z.string().min(2).max(50).trim(),
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8).max(100),
  referralCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, email, password, referralCode } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  let referrerId: string | undefined;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (referrer && !referrer.frozen) {
      referrerId = referrer.id;
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let code = generateReferralCode();
  // ensure unique
  while (await prisma.user.findUnique({ where: { referralCode: code } })) {
    code = generateReferralCode();
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      referralCode: code,
      referredBy: referrerId,
    },
  });

  if (referrerId) {
    await prisma.referral.create({
      data: { referrerId, referralId: user.id },
    });
  }

  const token = await createSession({ userId: user.id, role: user.role });
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
