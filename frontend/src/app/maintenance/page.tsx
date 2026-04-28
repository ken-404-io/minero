import Link from "next/link";
import { IconPickaxe, IconClock } from "@/components/icons";

export const metadata = { title: "Under Maintenance — Minero", robots: { index: false } };

export default function MaintenancePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div
        className="inline-flex items-center justify-center rounded-2xl mb-6"
        style={{ width: 72, height: 72, background: "var(--brand-weak)" }}
      >
        <IconPickaxe size={36} style={{ color: "var(--brand)" }} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Under maintenance</h1>
      <p className="text-base mb-1" style={{ color: "var(--text-muted)", maxWidth: 400 }}>
        We&rsquo;re making improvements to Minero. Please check back soon.
      </p>
      <p className="text-sm mb-8 flex items-center gap-1.5" style={{ color: "var(--text-subtle)" }}>
        <IconClock size={14} /> Usually back within an hour.
      </p>
      <Link href="/" className="btn btn-secondary btn-sm">
        Back to homepage
      </Link>
    </main>
  );
}
