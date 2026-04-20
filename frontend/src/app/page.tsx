import Link from "next/link";
import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import { PLANS } from "@/lib/mining";

type Me = { user: { id: string; name: string; role: string } };

export default async function LandingPage() {
  const me = await apiJson<Me>("/auth/me");
  if (me) redirect("/dashboard");

  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold" style={{ color: "var(--gold)" }}>⛏ Minero</span>
          <div className="flex gap-3">
            <Link href="/login" className="btn-secondary text-sm px-4 py-2">Login</Link>
            <Link href="/register" className="btn-primary text-sm px-4 py-2">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-4 py-24">
        <div
          className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-6"
          style={{ background: "#2d2000", color: "var(--gold)" }}
        >
          Powered by Ads · Sustainable by Design
        </div>
        <h1 className="text-5xl font-extrabold mb-4 max-w-2xl leading-tight">
          Earn Real Pesos.<br />
          <span style={{ color: "var(--gold)" }}>Every 10 Minutes.</span>
        </h1>
        <p className="text-lg mb-8 max-w-xl" style={{ color: "var(--muted)" }}>
          Minero is an ad-funded reward platform. Claim every 10 minutes, invite friends for
          10% commission, and cash out directly to GCash or Maya.
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Link href="/register" className="btn-primary text-base px-8 py-4">Start Mining Free</Link>
          <Link href="/login" className="btn-secondary text-base px-8 py-4">Sign In</Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4" style={{ background: "var(--surface)" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { n: "1", title: "Register Free", desc: "Create your account in 30 seconds. Get your unique referral code instantly." },
              { n: "2", title: "Claim Every 10 Min", desc: "Hit the claim button, watch a short ad, and earn ₱0.005–₱0.045 per claim." },
              { n: "3", title: "Cash Out to GCash", desc: "Reach ₱300 minimum and withdraw directly to GCash or Maya within 3–7 days." },
            ].map((step) => (
              <div key={step.n} className="card text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4"
                  style={{ background: "var(--gold)", color: "#000" }}
                >
                  {step.n}
                </div>
                <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Earning Plans</h2>
          <p className="text-center mb-12 text-sm" style={{ color: "var(--muted)" }}>
            Free to start. Upgrade anytime to earn more.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(PLANS).map(([key, plan]) => (
              <div
                key={key}
                className="card flex flex-col gap-3"
                style={key === "plan799" ? { border: "2px solid var(--gold)" } : {}}
              >
                {key === "plan799" && (
                  <div className="text-xs font-bold text-center py-1 rounded-full" style={{ background: "var(--gold)", color: "#000" }}>
                    BEST VALUE
                  </div>
                )}
                <div className="font-bold">{plan.label}</div>
                <div className="text-3xl font-extrabold" style={{ color: "var(--gold)" }}>
                  {plan.price === 0 ? "Free" : `₱${plan.price}`}
                </div>
                <ul className="text-sm space-y-1" style={{ color: "var(--muted)" }}>
                  <li>₱{plan.ratePerClaim}/claim</li>
                  <li>₱{plan.dailyCap} daily cap</li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Referral */}
      <section className="py-16 px-4" style={{ background: "var(--surface)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-5xl mb-4">🤝</div>
          <h2 className="text-3xl font-bold mb-4">10% Referral Commission</h2>
          <p className="text-lg mb-6" style={{ color: "var(--muted)" }}>
            Every time someone you invite earns, you earn 10% of their mining reward —
            automatically, forever.
          </p>
          <Link href="/register" className="btn-primary px-8 py-4 text-base">
            Get Your Referral Code
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-xs" style={{ color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
        <div className="flex flex-wrap gap-4 justify-center mb-3">
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          <Link href="/disclaimer" className="hover:underline">Earnings Disclaimer</Link>
        </div>
        <p>© 2026 Halvex Inc. · Minero · Earnings are not guaranteed and depend on ad availability and user activity.</p>
      </footer>
    </div>
  );
}
