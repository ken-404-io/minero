import Link from "next/link";
import { IconArrowLeft, IconWarning } from "@/components/icons";

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 lg:py-16">
      <Link href="/" className="link-brand text-sm mb-6 inline-flex items-center gap-1">
        <IconArrowLeft size={14} /> Back to home
      </Link>
      <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Earnings disclaimer</h1>
      <p className="text-sm mt-1 mb-8" style={{ color: "var(--text-muted)" }}>
        Last updated: April 2026 · Halvex Inc.
      </p>

      <div className="space-y-6 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        <div className="alert alert-warning">
          <IconWarning size={18} />
          <div>
            <div className="font-semibold mb-0.5">Earnings are not guaranteed</div>
            <span>Amounts shown are based on current ad rates and may change at any time.</span>
          </div>
        </div>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>Ad-dependent payouts</h2>
          <p>All rewards on Minero are funded by advertising revenue. If ad revenue decreases — due to market conditions, ad blocker usage, or network changes — earning rates and daily caps may be reduced without prior notice.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>No guaranteed income</h2>
          <p>Minero is an earning platform, not an investment product. There is no guaranteed return on plan purchases. Halvex Inc. makes no promises regarding the total amount you will earn.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>Activity required</h2>
          <p>Earnings require active participation: manual claims every 10 minutes, ad views, and compliance with platform rules. Inactivity or rule violations result in no earnings or account suspension.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>Rate changes</h2>
          <p>Halvex Inc. reserves the right to adjust earning rates, daily caps, referral commission rates, withdrawal minimums, and any other platform parameters at any time.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>Not a pyramid scheme</h2>
          <p>Minero&apos;s referral program pays commissions based only on actual ad-backed mining earnings of referrals, not on plan purchases or deposits. This is a sustainable affiliate model, not a pyramid or Ponzi structure.</p>
        </section>
      </div>
    </div>
  );
}
