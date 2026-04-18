import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/" className="text-sm hover:underline mb-6 block" style={{ color: "var(--gold)" }}>
        ← Back to Home
      </Link>
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>Last updated: April 2026 · Halvex Inc.</p>

      <div className="space-y-6 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>1. Acceptance</h2>
          <p>By registering on Minero, you agree to these Terms of Service. If you do not agree, do not use the platform.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>2. Eligibility</h2>
          <p>You must be at least 18 years old and a resident of the Philippines to use Minero. One account per person is allowed.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>3. Prohibited Conduct</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Creating multiple accounts (multi-accounting)</li>
            <li>Using bots, scripts, or automated tools to claim rewards</li>
            <li>Using VPNs or proxies to bypass IP checks</li>
            <li>Sharing accounts with others</li>
            <li>Any attempt to defraud the platform or other users</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>4. Earning & Withdrawals</h2>
          <p>Earnings are ad-funded and subject to daily caps. Halvex Inc. reserves the right to adjust rates, caps, and withdrawal terms at any time. Minimum withdrawal is ₱300. Processing takes 3–7 business days. Pending earnings are not withdrawable.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>5. Plans</h2>
          <p>All plan upgrades are one-time, non-refundable payments. Plans are lifetime unless otherwise stated.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>6. Account Suspension</h2>
          <p>Halvex Inc. reserves the right to freeze, suspend, or terminate any account that violates these terms, cancel pending withdrawals, and forfeit associated balances without prior notice.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>7. Platform Availability</h2>
          <p>We do not guarantee uninterrupted access. Halvex Inc. may suspend or discontinue Minero at any time.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>8. Governing Law</h2>
          <p>These terms are governed by the laws of the Philippines.</p>
        </section>
      </div>
    </div>
  );
}
