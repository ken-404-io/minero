"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api-url";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
};

type ListResponse = { notifications: Notification[] };

const POLL_MS = 30_000;

export default function ReferralCreditToast() {
  const [toast, setToast] = useState<{ id: string; amount: string } | null>(null);
  const [visible, setVisible] = useState(false);
  const shownIds = useRef<Set<string>>(new Set());
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function checkAndShow() {
    try {
      const res = await fetch(`${API_URL}/notifications?limit=50`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as ListResponse;
      const unread = data.notifications.filter(
        (n) => n.type === "referral_credited" && !n.readAt && !shownIds.current.has(n.id)
      );
      if (unread.length === 0) return;

      // Pick the latest one; mark all as read immediately.
      const latest = unread[0];
      for (const n of unread) {
        shownIds.current.add(n.id);
        fetch(`${API_URL}/notifications/read`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: unread.map((u) => u.id) }),
        }).catch(() => {});
      }

      // Extract amount from body, e.g. "₱50.00 from your referral…"
      const match = latest.body.match(/₱[\d,.]+/);
      const amount = match ? match[0] : "";

      // Clear any previous toast timer before showing a new one.
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      setToast({ id: latest.id, amount });
      setVisible(true);

      fadeTimer.current = setTimeout(() => {
        setVisible(false);
        fadeTimer.current = setTimeout(() => setToast(null), 600);
      }, 5000);
    } catch {
      // silent
    }
  }

  useEffect(() => {
    checkAndShow();
    const id = setInterval(checkAndShow, POLL_MS);
    return () => {
      clearInterval(id);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!toast) return null;

  return (
    <>
      <style>{`
        @keyframes rcToastIn {
          from { opacity: 0; transform: translateY(32px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
        @keyframes rcCoinFloat {
          0%   { transform: translateY(0)   rotate(-8deg); opacity: 1; }
          50%  { transform: translateY(-18px) rotate(8deg);  opacity: 1; }
          100% { transform: translateY(-34px) rotate(-4deg); opacity: 0; }
        }
        .rc-toast {
          position: fixed;
          bottom: 88px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          pointer-events: none;
          animation: rcToastIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .rc-toast-hidden {
          opacity: 0;
          transform: translateX(-50%) translateY(16px);
        }
        .rc-toast-card {
          background: linear-gradient(135deg, #1a2e1a 0%, #0f1f0f 100%);
          border: 1px solid rgba(74,222,128,0.35);
          border-radius: 16px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(74,222,128,0.1);
          white-space: nowrap;
        }
        .rc-toast-icon {
          font-size: 26px;
          animation: rcCoinFloat 1.2s ease-in-out 0.2s both;
          display: inline-block;
        }
        .rc-toast-text { display: flex; flex-direction: column; gap: 2px; }
        .rc-toast-title {
          font-size: 13px;
          font-weight: 600;
          color: #86efac;
          letter-spacing: 0.01em;
        }
        .rc-toast-amount {
          font-size: 22px;
          font-weight: 800;
          color: #4ade80;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }
        .rc-toast-sub {
          font-size: 11px;
          color: rgba(134,239,172,0.6);
          margin-top: 1px;
        }
      `}</style>
      <div className={`rc-toast${visible ? "" : " rc-toast-hidden"}`} aria-live="polite" aria-atomic="true">
        <div className="rc-toast-card">
          <span className="rc-toast-icon">🪙</span>
          <div className="rc-toast-text">
            <span className="rc-toast-title">Invite credits received!</span>
            {toast.amount && <span className="rc-toast-amount">{toast.amount}</span>}
            <span className="rc-toast-sub">credited to your balance</span>
          </div>
        </div>
      </div>
    </>
  );
}
