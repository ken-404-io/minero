import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import AdminNotificationsClient from "./AdminNotificationsClient";

type Me = { user: { role: string } };

type AdminNotificationRow = {
  title: string;
  body: string;
  link: string | null;
  sentAt: string;
  sentBy: string | null;
  recipients: number;
  reads: number;
};

type AdminNotificationsResp = { notifications: AdminNotificationRow[] };

export default async function AdminNotificationsPage() {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");
  if (me.user.role !== "admin") redirect("/dashboard");

  const data = await apiJson<AdminNotificationsResp>("/admin/notifications?limit=20");
  const recent = data?.notifications ?? [];

  return <AdminNotificationsClient recent={recent} />;
}
