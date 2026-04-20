"use client";

import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";

export default function AdminLogout() {
  const router = useRouter();

  async function logout() {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/");
    router.refresh();
  }

  return (
    <button onClick={logout} className="btn-secondary w-full text-sm py-2">
      Sign Out
    </button>
  );
}
