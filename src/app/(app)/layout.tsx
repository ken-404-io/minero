import { getSession } from "@/backend/lib/auth";
import { prisma } from "@/backend/lib/db";
import { redirect } from "next/navigation";
import DashNav from "@/frontend/components/DashNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, role: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <DashNav name={user.name} role={user.role} />
      <main className="flex-1 flex flex-col overflow-auto">{children}</main>
    </div>
  );
}
