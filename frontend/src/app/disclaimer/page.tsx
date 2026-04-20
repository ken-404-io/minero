import Link from "next/link";

export default function DisclaimerPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/" className="text-sm hover:underline mb-6 block" style={{ color: "var(--gold)" }}>
        ← Back to Home
      </Link>
      <h1 className="text-3xl font-bold mb-2">Earnings Disclaimer</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>Last updated: April 2026 · Halvex Inc.</p>

      <div className="space-y-6 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        <section className="p-4 rounded-lg" style={{ background: "#2d1a00", border: "1px solid #f59e0b40" }}>
          <p className="font-semibold" style={{ color: "#f59e0b" }}>
            Important: Earnings on Minero are not guaranteed. The amounts shown are based on current ad rates and may change at any time.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>Ad-Dependent Payouts</h2>
          <p>All rewards on Minero are funded by advertising revenue. If ad revenue decreases — due to market conditions, ad blocker usage, or network changes — earning rates and daily caps may be reduced without prior notice.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>No Guaranteed Income</h2>
          <p>Minero is an earning platform, not an investment product. There is no guaranteed return on plan purchases. Halvex Inc. makes no promises regarding the total amount you will earn.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>Activity Required</h2>
          <p>Earnings require active participation: manual claims every 10 minutes, ad views, and compliance with platform rules. Inactivity or rule violations result in no earnings or account suspension.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>Rate Changes</h2>
          <p>Halvex Inc. reserves the right to adjust earning rates, daily caps, referral commission rates, withdrawal minimums, and any other platform parameters at any time.</p>
        </section>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>Not a Pyramid Scheme</h2>
          <p>Minero&apos;s referral program pays commissions based only on actual ad-backed mining earnings of referrals, not on plan purchases or deposits. This is a sustainable affiliate model, not a pyramid or Ponzi structure.</p>
        </section>
      </div>
    </div>
  );
}
