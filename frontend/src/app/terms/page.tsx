import Link from "next/link";
import { IconArrowLeft } from "@/components/icons";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 lg:py-16">
      <Link href="/" className="link-brand text-sm mb-6 inline-flex items-center gap-1">
        <IconArrowLeft size={14} /> Back to home
      </Link>
      <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Terms of service</h1>
      <p className="text-sm mt-1 mb-8" style={{ color: "var(--text-muted)" }}>
        Last updated: April 2026 · Strong Fund Inc.
      </p>

      <div className="space-y-6 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>1. Acceptance</h2>
          <p>By registering on Minero, you agree to these Terms of Service. If you do not agree, do not use the platform.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>2. Eligibility</h2>
          <p>You must be at least 18 years old and a resident of the Philippines to use Minero. One account per person is allowed.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>3. Prohibited conduct</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Creating multiple accounts (multi-accounting)</li>
            <li>Using bots, scripts, or automated tools to claim rewards</li>
            <li>Using VPNs or proxies to bypass IP checks</li>
            <li>Sharing accounts with others</li>
            <li>Any attempt to defraud the platform or other users</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>4. Earning &amp; withdrawals</h2>
          <p>Earnings are ad-funded and subject to daily caps. Strong Fund Inc. reserves the right to adjust rates, caps, and withdrawal terms at any time. Minimum withdrawal is ₱300. Processing takes 3–7 business days. Pending earnings are not withdrawable.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>5. Plans</h2>
          <p>All plan upgrades are one-time, non-refundable payments. Plans are lifetime unless otherwise stated.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>6. Account suspension</h2>
          <p>Strong Fund Inc. reserves the right to freeze, suspend, or terminate any account that violates these terms, cancel pending withdrawals, and forfeit associated balances without prior notice.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>7. Platform availability</h2>
          <p>We do not guarantee uninterrupted access. Strong Fund Inc. may suspend or discontinue Minero at any time.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>8. Governing law</h2>
          <p>These terms are governed by the laws of the Philippines.</p>
        </section>
      </div>
    </div>
  );
}
