import Link from "next/link";
import { IconPickaxe, IconArrowRight } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <span
        aria-hidden
        className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-6"
        style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
      >
        <IconPickaxe size={32} />
      </span>

      <p className="text-sm font-mono mb-2" style={{ color: "var(--brand)" }}>404</p>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
        Nothing mined here.
      </h1>
      <p className="text-base max-w-sm mb-8" style={{ color: "var(--text-muted)" }}>
        This page doesn&apos;t exist or was moved. Head back to start earning.
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link href="/" className="btn btn-primary btn-lg">
          Go home <IconArrowRight size={18} />
        </Link>
        <Link href="/dashboard" className="btn btn-secondary btn-lg">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
