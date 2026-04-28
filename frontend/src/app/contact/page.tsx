import Link from "next/link";
import { IconArrowLeft, IconMail, IconShield, IconClock } from "@/components/icons";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@tagamina.com";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 lg:py-16">
      <Link href="/" className="link-brand text-sm mb-6 inline-flex items-center gap-1">
        <IconArrowLeft size={14} /> Back to home
      </Link>

      <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Contact &amp; Support</h1>
      <p className="text-sm mt-1 mb-8" style={{ color: "var(--text-muted)" }}>
        Strong Fund Inc. · Minero support
      </p>

      <div className="space-y-6">
        {/* Primary contact card */}
        <div className="card flex items-start gap-4" style={{ padding: "1.25rem" }}>
          <span
            aria-hidden
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg mt-0.5"
            style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
          >
            <IconMail size={20} />
          </span>
          <div>
            <h2 className="font-semibold text-base mb-1">Email support</h2>
            <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>
              For account issues, withdrawal disputes, data requests, or general questions.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="link-brand font-mono text-sm"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        {/* Response time */}
        <div className="card flex items-start gap-4" style={{ padding: "1.25rem" }}>
          <span
            aria-hidden
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg mt-0.5"
            style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
          >
            <IconClock size={20} />
          </span>
          <div>
            <h2 className="font-semibold text-base mb-1">Response time</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              We typically respond within <strong style={{ color: "var(--text)" }}>1–3 business days</strong>.
              For withdrawal disputes include your registered email and the withdrawal ID shown in your history.
            </p>
          </div>
        </div>

        {/* Data privacy */}
        <div className="card flex items-start gap-4" style={{ padding: "1.25rem" }}>
          <span
            aria-hidden
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg mt-0.5"
            style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
          >
            <IconShield size={20} />
          </span>
          <div>
            <h2 className="font-semibold text-base mb-1">Data &amp; privacy requests</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              To request access to or deletion of your personal data, email us with the subject line
              {" "}<em>&ldquo;Data Request&rdquo;</em> from your registered email address.
              See our{" "}
              <Link href="/privacy" className="link-brand">Privacy Policy</Link> for details.
            </p>
          </div>
        </div>

        {/* Quick links */}
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>
          Before reaching out, check our{" "}
          <Link href="/terms" className="link-brand">Terms of Service</Link>,{" "}
          <Link href="/disclaimer" className="link-brand">Earnings Disclaimer</Link>, and{" "}
          <Link href="/privacy" className="link-brand">Privacy Policy</Link> — your question may already be answered there.
        </div>
      </div>
    </div>
  );
}
