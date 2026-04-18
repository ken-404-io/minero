import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/" className="text-sm hover:underline mb-6 block" style={{ color: "var(--gold)" }}>
        ← Back to Home
      </Link>
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>Last updated: April 2026 · Halvex Inc.</p>

      <div className="space-y-6 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>1. Data We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account information: name, email address, hashed password</li>
            <li>Activity data: claim timestamps, IP addresses, device fingerprints</li>
            <li>Financial data: withdrawal requests, payment reference numbers</li>
            <li>Referral data: referral codes and commission records</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>2. How We Use Your Data</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To operate and maintain the platform</li>
            <li>To detect and prevent fraud and multi-accounting</li>
            <li>To process withdrawal requests</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>3. Data Sharing</h2>
          <p>We do not sell your personal data. We may share data with payment processors (GCash, Maya) solely to process withdrawals, and with law enforcement when required by law.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>4. Cookies & Tracking</h2>
          <p>We use session cookies for authentication. Ad networks (Google AdSense, etc.) may set their own cookies for ad targeting.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>5. Data Retention</h2>
          <p>Account and earnings data is retained for a minimum of 2 years for financial record-keeping purposes.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>6. Your Rights</h2>
          <p>You may request access to or deletion of your personal data by contacting us. Note: deletion of financial records may be restricted by law.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>7. Contact</h2>
          <p>For privacy concerns, contact Halvex Inc. via the support channel in your account dashboard.</p>
        </section>
      </div>
    </div>
  );
}
