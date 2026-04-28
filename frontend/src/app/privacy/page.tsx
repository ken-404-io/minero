import Link from "next/link";
import { IconArrowLeft } from "@/components/icons";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 lg:py-16">
      <Link href="/" className="link-brand text-sm mb-6 inline-flex items-center gap-1">
        <IconArrowLeft size={14} /> Back to home
      </Link>
      <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Privacy policy</h1>
      <p className="text-sm mt-1 mb-8" style={{ color: "var(--text-muted)" }}>
        Last updated: April 2026 · Halvex Inc.
      </p>

      <div className="space-y-6 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>1. Data we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account information: name, email address, hashed password</li>
            <li>Activity data: claim timestamps, IP addresses, device fingerprints</li>
            <li>Financial data: withdrawal requests, payment reference numbers</li>
            <li>Referral data: referral codes and commission records</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>2. How we use your data</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To operate and maintain the platform</li>
            <li>To detect and prevent fraud and multi-accounting</li>
            <li>To process withdrawal requests</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>3. Data sharing</h2>
          <p>We do not sell your personal data. We may share data with payment processors (GCash, Maya) solely to process withdrawals, and with law enforcement when required by law.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>4. Cookies &amp; tracking</h2>
          <p>We use session cookies for authentication. Ad networks (Google AdSense, etc.) may set their own cookies for ad targeting.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>5. Data retention</h2>
          <p>Account and earnings data is retained for a minimum of 2 years for financial record-keeping purposes.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>6. Your rights</h2>
          <p>You may request access to or deletion of your personal data by contacting us. Note: deletion of financial records may be restricted by law.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>7. Contact</h2>
          <p>
            For privacy concerns or data requests, contact Halvex Inc. via our{" "}
            <Link href="/contact" className="link-brand underline underline-offset-2">support page</Link>.
            Include &ldquo;Data Request&rdquo; in the subject line and send from your registered email address.
          </p>
        </section>
      </div>
    </div>
  );
}
