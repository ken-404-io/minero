import Skeleton from "@/components/Skeleton";

export default function MeLoading() {
  return (
    <div
      className="flex flex-col"
      style={{ background: "var(--bg)" }}
      aria-busy="true"
      role="status"
      aria-label="Loading profile"
    >
      {/* Brand-colored identity header */}
      <section
        className="px-4 pt-6 pb-8 lg:px-8 lg:pt-8"
        style={{
          background:
            "linear-gradient(180deg, var(--brand) 0%, var(--brand-pressed) 100%)",
        }}
      >
        <div className="mx-auto max-w-[1280px] flex items-center gap-4">
          <Skeleton
            width={56}
            height={56}
            radius={9999}
            style={{ background: "color-mix(in oklab, var(--brand-fg) 25%, transparent)" }}
          />
          <div className="flex-1 min-w-0">
            <Skeleton
              width="60%"
              height={22}
              style={{
                marginBottom: 8,
                background: "color-mix(in oklab, var(--brand-fg) 25%, transparent)",
              }}
            />
            <Skeleton
              width="45%"
              height={14}
              style={{
                marginBottom: 10,
                background: "color-mix(in oklab, var(--brand-fg) 20%, transparent)",
              }}
            />
            <div className="flex items-center gap-2">
              <Skeleton
                width={48}
                height={18}
                radius={9999}
                style={{ background: "color-mix(in oklab, var(--brand-fg) 25%, transparent)" }}
              />
              <Skeleton
                width={140}
                height={12}
                style={{ background: "color-mix(in oklab, var(--brand-fg) 20%, transparent)" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Menu card */}
      <section className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 -mt-4">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3.5"
              style={{
                borderBottom:
                  i === 7 ? "none" : "1px solid var(--border)",
              }}
            >
              <Skeleton width={36} height={36} radius={8} />
              <div className="flex-1 min-w-0">
                <Skeleton width="40%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="60%" height={12} />
              </div>
              <Skeleton width={18} height={18} radius={9999} />
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <Skeleton width={120} height={36} radius={8} />
        </div>
      </section>
    </div>
  );
}
