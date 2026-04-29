"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api-url";
import { IconWarning, IconX, IconSend, IconCheck } from "@/components/icons";

const STORAGE_KEY = "minero_report_date_v1";

function todayUtcStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function alreadyReportedToday(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === todayUtcStr();
  } catch {
    return false;
  }
}

function markReportedToday() {
  try {
    localStorage.setItem(STORAGE_KEY, todayUtcStr());
  } catch {}
}

export default function ReportButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function handleOpen() {
    setOpen(true);
    setSuccess(false);
    setError("");
  }

  function handleClose() {
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (alreadyReportedToday()) {
      setError("You have already submitted a report today. Try again tomorrow.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to submit. Please try again.");
      } else {
        markReportedToday();
        setSuccess(true);
        setMessage("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const alreadyReported = alreadyReportedToday();

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={handleOpen}
        aria-label="Report a problem"
        title="Report a problem"
        className="fixed right-4 bottom-20 lg:bottom-6 lg:right-6 z-40 flex items-center justify-center rounded-full w-11 h-11 shadow-md transition-opacity hover:opacity-90"
        style={{
          background: "var(--danger-weak)",
          color: "var(--danger-fg)",
          border: "1px solid color-mix(in oklab, var(--danger) 30%, transparent)",
        }}
      >
        <IconWarning size={20} />
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report a problem"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div
            className="card w-full relative"
            style={{ maxWidth: 480 }}
          >
            <button
              onClick={handleClose}
              aria-label="Close"
              className="btn-icon absolute top-3 right-3"
            >
              <IconX size={18} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <IconWarning size={18} style={{ color: "var(--danger-fg)", flexShrink: 0 }} />
              <h2 className="text-lg font-semibold">Report a Problem</h2>
            </div>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Describe the issue you&apos;re experiencing. You can submit one report per day.
            </p>

            {success ? (
              <div className="alert alert-success flex items-center gap-2">
                <IconCheck size={16} />
                <span>Report submitted. Our team will look into it — thank you!</span>
              </div>
            ) : alreadyReported ? (
              <div className="alert alert-warning flex items-center gap-2">
                <IconWarning size={16} />
                <span>You&apos;ve already submitted a report today. Try again tomorrow.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="alert alert-danger mb-3 text-sm" role="alert">
                    {error}
                  </div>
                )}
                <label className="input-label" htmlFor="report-message">
                  What&apos;s wrong?
                </label>
                <textarea
                  id="report-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the problem in as much detail as possible…"
                  rows={5}
                  maxLength={1000}
                  className="input w-full mt-1"
                  style={{ resize: "vertical", minHeight: 120 }}
                  required
                  disabled={busy}
                />
                <div
                  className="text-xs text-right mt-1 mb-4"
                  style={{ color: "var(--text-subtle)" }}
                >
                  {message.length} / 1,000
                </div>
                <button
                  type="submit"
                  disabled={busy || message.trim().length < 10}
                  className="btn btn-primary w-full"
                >
                  <IconSend size={15} />
                  {busy ? "Submitting…" : "Submit Report"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
