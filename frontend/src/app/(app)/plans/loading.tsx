import Skeleton from "@/components/Skeleton";

export default function PlansLoading() {
  return (
    <div
      className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8"
      aria-busy="true"
      role="status"
      aria-label="Loading plans"
    >
      <header className="mb-6 lg:mb-8">
        <Skeleton width={60} height={12} style={{ marginBottom: 8 }} />
        <Skeleton width={220} height={28} style={{ marginBottom: 6 }} />
        <Skeleton width={300} height={14} />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Skeleton width={90} height={16} />
              <Skeleton width={56} height={20} radius={9999} />
            </div>
            <Skeleton width={120} height={38} />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <Skeleton width={14} height={14} radius={9999} />
                  <Skeleton width="80%" height={14} />
                </div>
              ))}
            </div>
            <Skeleton width="100%" height={40} radius={8} />
          </div>
        ))}
      </div>

      {/* Comparison table (desktop) */}
      <div className="card hidden lg:block" style={{ padding: 0, overflow: "hidden" }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <Skeleton width={160} height={18} />
        </div>
        <div className="p-4 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-3 items-center">
              <Skeleton width="70%" height={14} />
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} width="50%" height={14} style={{ justifySelf: "center" }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
