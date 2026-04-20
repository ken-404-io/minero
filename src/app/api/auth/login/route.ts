import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/backend/lib/db";
import { createSession } from "@/backend/lib/auth";
import { cookies } from "next/headers";

const schema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
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
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const { email, password } = result.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await bcrypt.hash("dummy", 12);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (user.frozen) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
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
