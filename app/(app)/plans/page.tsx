import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { PLANS } from "@/lib/mining";
import PlansClient from "./PlansClient";

export default async function PlansPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { plan: true },
  });
  if (!user) redirect("/login");

  return <PlansClient currentPlan={user.plan} plans={PLANS} />;
}
