"use client";

import { useRef, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { IconReport, IconWarning, IconX, IconSend, IconCheck } from "@/components/icons";

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

type UploadSig = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
};

async function uploadToCloudinary(file: File, sig: UploadSig): Promise<string> {
  const isVideo = file.type.startsWith("video/");
  const url = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${isVideo ? "video" : "image"}/upload`;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", sig.apiKey);
  fd.append("timestamp", String(sig.timestamp));
  fd.append("signature", sig.signature);
  fd.append("folder", sig.folder);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed");
  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}

export default function ReportButton() {
  const [open, setOpen]           = useState(false);
  const [message, setMessage]     = useState("");
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy]           = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setOpen(true);
    setSuccess(false);
    setError("");
  }

  function handleClose() {
    setOpen(false);
    setFile(null);
    setPreview(null);
    setError("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  }

  function removeFile() {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
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
      let mediaUrl: string | undefined;

      // Upload media first if a file is attached.
      if (file) {
        setUploading(true);
        const sigRes = await fetch(`${API_URL}/report/upload-signature`, {
          credentials: "include",
        });
        if (!sigRes.ok) throw new Error("Could not get upload token.");
        const sig = (await sigRes.json()) as UploadSig;
        mediaUrl = await uploadToCloudinary(file, sig);
        setUploading(false);
      }

      const res = await fetch(`${API_URL}/report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mediaUrl }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to submit. Please try again.");
      } else {
        markReportedToday();
        setSuccess(true);
        setMessage("");
        setFile(null);
        setPreview(null);
      }
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setBusy(false);
      setUploading(false);
    }
  }

  const alreadyReported = alreadyReportedToday();
  const isVideo = file?.type.startsWith("video/");

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={handleOpen}
        aria-label="Report a problem"
        title="Report a problem"
        className="fixed right-4 bottom-20 lg:bottom-6 lg:right-6 z-40 flex items-center justify-center rounded-full w-11 h-11 shadow-md transition-opacity hover:opacity-90"
        style={{
          background: "var(--brand)",
          color: "var(--brand-fg)",
          border: "1px solid var(--brand)",
        }}
      >
        <IconReport size={20} />
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
          <div className="card w-full relative" style={{ maxWidth: 480 }}>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="btn-icon absolute top-3 right-3"
            >
              <IconX size={18} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <IconReport size={18} style={{ color: "var(--brand)", flexShrink: 0 }} />
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
                  rows={4}
                  maxLength={1000}
                  className="input w-full mt-1"
                  style={{ resize: "vertical", minHeight: 100 }}
                  required
                  disabled={busy}
                />
                <div
                  className="text-xs text-right mt-1 mb-3"
                  style={{ color: "var(--text-subtle)" }}
                >
                  {message.length} / 1,000
                </div>

                {/* Media attachment */}
                <div className="mb-4">
                  <span className="input-label mb-2 block">Attach image or video (optional)</span>

                  {preview ? (
                    <div className="relative rounded-lg overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      {isVideo ? (
                        <video
                          src={preview}
                          controls
                          className="w-full rounded-lg"
                          style={{ maxHeight: 200 }}
                        />
                      ) : (
                        <img
                          src={preview}
                          alt="Preview"
                          className="w-full rounded-lg object-cover"
                          style={{ maxHeight: 200 }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={removeFile}
                        disabled={busy}
                        aria-label="Remove attachment"
                        className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-full"
                        style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => fileRef.current?.click()}
                      className="w-full py-3 rounded-lg border-2 border-dashed text-sm font-medium transition-colors"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-muted)",
                        background: "var(--surface-2)",
                      }}
                    >
                      + Add screenshot or video
                    </button>
                  )}

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={busy}
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || message.trim().length < 10}
                  className="btn btn-primary w-full"
                >
                  <IconSend size={15} />
                  {uploading ? "Uploading…" : busy ? "Submitting…" : "Submit Report"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
