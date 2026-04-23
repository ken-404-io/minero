import Link from "next/link";
import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import { AD_FREE_FEE_PHP } from "@/lib/mining";
import {
  IconPickaxe,
  IconCheck,
  IconArrowRight,
  IconBoltSmall,
  IconUsers,
  IconWallet,
  IconClock,
  IconShield,
} from "@/components/icons";

type Me = { user: { id: string; name: string; role: string; plan: string } };

export default async function LandingPage() {
  const me = await apiJson<Me>("/auth/me");
  if (me) {
    if (me.user.role !== "admin" && me.user.plan !== "paid") redirect("/activate");
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* ======================== Top nav (both breakpoints) ======================== */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in oklab, var(--bg) 85%, transparent)",
          backdropFilter: "saturate(1.2) blur(10px)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Minero home">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
            >
              <IconPickaxe size={20} />
            </span>
            <span className="text-lg font-semibold tracking-tight">Minero</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Marketing">
            <a href="#how" className="btn btn-ghost btn-sm">How it works</a>
            <a href="#pricing" className="btn btn-ghost btn-sm">Pricing</a>
            <a href="#referral" className="btn btn-ghost btn-sm">Referral</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              Sign in
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm">
              Get started
              <IconArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      {/* ======================== Hero ======================== */}
      <section className="px-4 sm:px-6 pt-10 sm:pt-16 lg:pt-24 pb-16 lg:pb-24">
        <div className="mx-auto max-w-6xl grid gap-10 lg:grid-cols-[1.1fr_1fr] items-center">
          <div>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-5"
              style={{
                background: "var(--brand-weak)",
                color: "var(--brand-weak-fg)",
                border: "1px solid color-mix(in oklab, var(--brand) 25%, transparent)",
              }}
            >
              <IconBoltSmall size={12} />
              Ad-funded · Sustainable by design
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              Earn real pesos,
              <br />
              <span style={{ color: "var(--brand)" }}>every 10 minutes.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg max-w-xl" style={{ color: "var(--text-muted)" }}>
              Minero pays small, steady rewards for watching short ads — and a 10% forever commission on
              everyone you invite. Cash out to GCash or Maya once you hit ₱300.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-primary btn-lg">
                Start mining free
                <IconArrowRight size={18} />
              </Link>
              <Link href="/login" className="btn btn-secondary btn-lg">
                Sign in
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
              {[
                "No credit card",
                "₱300 minimum payout",
                "GCash & Maya supported",
              ].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <IconCheck size={14} style={{ color: "var(--success-fg)" }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visual preview — functional, not decorative orbs */}
          <div className="relative hidden lg:block">
            <div
              className="card"
              style={{
                padding: "1.25rem",
                background: "var(--bg-elevated)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="section-title">Today</span>
                <span className="badge badge-approved">Live</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="kpi">
                  <span className="kpi-label">Available</span>
                  <span className="kpi-value kpi-value-brand">₱348.22</span>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Today</span>
                  <span className="kpi-value">₱6.48</span>
                </div>
              </div>
              <div className="mt-4 surface-2 p-4 flex items-center gap-4">
                <div
                  className="inline-flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "var(--brand)", color: "var(--brand-fg)" }}
                >
                  <IconPickaxe size={24} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Claim ready</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>₱0.045 per claim</div>
                </div>
                <button className="btn btn-primary btn-sm" disabled>Claim</button>
              </div>
              <div className="mt-3 text-xs text-center" style={{ color: "var(--text-subtle)" }}>
                Preview · not interactive
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================== How it works ======================== */}
      <section id="how" className="px-4 sm:px-6 py-16 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl mb-10">
            <span className="section-title">Getting started</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">
              Three steps. No surprises.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                Icon: IconUsers,
                title: "Register free",
                body: "Create your account in 30 seconds. Get a unique referral code the moment you join.",
              },
              {
                Icon: IconClock,
                title: "Claim every 10 min",
                body: "Tap claim, watch a short ad, and earn between ₱0.005 and ₱0.045 per claim.",
              },
              {
                Icon: IconWallet,
                title: "Cash out to GCash",
                body: "Hit the ₱300 minimum and withdraw directly to GCash or Maya within 3–7 days.",
              },
            ].map(({ Icon, title, body }, i) => (
              <div key={title} className="card card-hover">
                <div className="flex items-center gap-3 mb-3">
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: "var(--surface-2)", color: "var(--brand)" }}
                  >
                    <Icon size={20} />
                  </span>
                  <span className="text-xs font-mono" style={{ color: "var(--text-subtle)" }}>
                    0{i + 1}
                  </span>
                </div>
                <h3 className="font-semibold text-lg mb-1.5">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================== Pricing ======================== */}
      <section id="pricing" className="px-4 sm:px-6 py-16 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <span className="section-title">Pricing</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">
              Free to mine. Pay to remove ads.
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Mining is free for everyone. Pay once to remove all ads — no subscriptions, no tiers.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mx-auto max-w-2xl">
            <div className="card flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Free</span>
                <span className="badge">With ads</span>
              </div>
              <div>
                <div className="text-5xl font-bold">₱0</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>Always free</div>
              </div>
              <ul className="space-y-2 text-sm flex-1">
                <li className="flex items-start gap-2">
                  <IconCheck size={16} style={{ color: "var(--success-fg)" }} className="mt-0.5 shrink-0" />
                  <span>Claim every 10 minutes</span>
                </li>
                <li className="flex items-start gap-2">
                  <IconCheck size={16} style={{ color: "var(--success-fg)" }} className="mt-0.5 shrink-0" />
                  <span>10% referral commission</span>
                </li>
                <li className="flex items-start gap-2">
                  <IconCheck size={16} style={{ color: "var(--success-fg)" }} className="mt-0.5 shrink-0" />
                  <span>Withdraw once you reach ₱300</span>
                </li>
              </ul>
              <Link href="/register" className="btn btn-secondary btn-lg">
                Start for free
              </Link>
            </div>

            <div className="card flex flex-col gap-4" style={{ borderColor: "var(--brand)" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Ad-Free</span>
                <span className="badge badge-approved">One-time</span>
              </div>
              <div>
                <div className="text-5xl font-bold" style={{ color: "var(--brand)" }}>
                  ₱{AD_FREE_FEE_PHP}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>One-time · lifetime</div>
              </div>
              <ul className="space-y-2 text-sm flex-1">
                <li className="flex items-start gap-2">
                  <IconCheck size={16} style={{ color: "var(--success-fg)" }} className="mt-0.5 shrink-0" />
                  <span>Everything in Free</span>
                </li>
                <li className="flex items-start gap-2">
                  <IconCheck size={16} style={{ color: "var(--success-fg)" }} className="mt-0.5 shrink-0" />
                  <span>No ads, ever</span>
                </li>
                <li className="flex items-start gap-2">
                  <IconCheck size={16} style={{ color: "var(--success-fg)" }} className="mt-0.5 shrink-0" />
                  <span>GCash, Maya, or card (PayMongo)</span>
                </li>
              </ul>
              <Link href="/register" className="btn btn-primary btn-lg">
                Get started
                <IconArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ======================== Referral ======================== */}
      <section id="referral" className="px-4 sm:px-6 py-16 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl grid gap-10 lg:grid-cols-[1fr_1fr] items-center">
          <div>
            <span className="section-title">Referral program</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2">
              10% commission, forever.
            </h2>
            <p className="mt-3 text-base" style={{ color: "var(--text-muted)" }}>
              Every time someone you invite earns, you earn 10% of their mining reward — automatically.
              No caps, no expiry, no re-enrollment.
            </p>
            <Link href="/register" className="mt-6 btn btn-primary btn-lg inline-flex">
              Get your referral code
              <IconArrowRight size={18} />
            </Link>
          </div>
          <div className="card" style={{ background: "var(--bg-elevated)" }}>
            <div className="section-title mb-3">How it works</div>
            <ol className="space-y-3 text-sm">
              {[
                "Share your referral link with friends.",
                "They register and start mining.",
                "You earn 10% of each approved claim they make.",
                "Commissions clear after a 24–72h fraud review.",
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
                    style={{ background: "var(--brand-weak)", color: "var(--brand-weak-fg)" }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ======================== Trust / disclaimer ======================== */}
      <section className="px-4 sm:px-6 py-10 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-4xl">
          <div className="alert alert-warning">
            <IconShield size={18} />
            <div>
              <div className="font-semibold mb-1">Earnings are not guaranteed</div>
              <div className="text-sm" style={{ color: "var(--warning-fg)", opacity: 0.9 }}>
                Rewards depend on ad availability and your activity. Plans are one-time and non-refundable.
                Read our{" "}
                <Link href="/disclaimer" className="underline underline-offset-2">earnings disclaimer</Link>{" "}
                for full terms.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================== Footer ======================== */}
      <footer className="mt-auto px-4 sm:px-6 py-8 border-t" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-6 w-6 items-center justify-center rounded"
              style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
            >
              <IconPickaxe size={14} />
            </span>
            <span>© 2026 Halvex Inc. · Minero</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/terms" className="hover:underline underline-offset-2">Terms</Link>
            <Link href="/privacy" className="hover:underline underline-offset-2">Privacy</Link>
            <Link href="/disclaimer" className="hover:underline underline-offset-2">Disclaimer</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
