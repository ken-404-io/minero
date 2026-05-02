"use server";

import { apiFetch } from "@/lib/api";

export async function approveReferralCommissions(): Promise<{ approved: number } | { error: string }> {
  try {
    const res = await apiFetch("/admin/referrals/approve?force=true", { method: "POST" });
    const data = await res.json() as { approved?: number; error?: string };
    if (!res.ok) return { error: data.error ?? `Server error ${res.status}` };
    return { approved: data.approved ?? 0 };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}
