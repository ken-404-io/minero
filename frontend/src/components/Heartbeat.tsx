"use client";

import { useEffect } from "react";
import { API_URL } from "@/lib/api-url";

export default function Heartbeat() {
  useEffect(() => {
    function ping() {
      fetch(`${API_URL}/auth/heartbeat`, { method: "POST", credentials: "include" }).catch(
        () => {}
      );
    }

    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
