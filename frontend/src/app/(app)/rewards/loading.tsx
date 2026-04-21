import Skeleton from "@/components/Skeleton";

export default function RewardsLoading() {
  return (
    <div
      className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8"
      aria-busy="true"
      role="status"
      aria-label="Loading rewards"
    >
      <header className="mb-6 lg:mb-8">
        <Skeleton width={56} height={12} style={{ marginBottom: 8 }} />
        <Skeleton width={160} height={28} style={{ marginBottom: 6 }} />
        <Skeleton width={280} height={14} />
      </header>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi">
            <Skeleton width={110} height={12} style={{ marginBottom: 8 }} />
            <Skeleton width={90} height={22} />
          </div>
        ))}
      </div>

      {/* Reward card grid */}
      <div className="mb-8">
        <Skeleton width={120} height={12} style={{ marginBottom: 12 }} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Skeleton width={44} height={44} radius={10} />
                <div className="flex-1 min-w-0">
                  <Skeleton width="55%" height={16} style={{ marginBottom: 6 }} />
                  <Skeleton width="40%" height={12} />
                </div>
                <Skeleton width={54} height={28} />
              </div>
              <Skeleton width="100%" height={6} radius={9999} />
              <Skeleton width="100%" height={36} radius={8} />
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div>
        <Skeleton width={160} height={12} style={{ marginBottom: 12 }} />
        <div className="card flex items-center gap-3">
          <Skeleton width={18} height={18} radius={9999} />
          <Skeleton width="60%" height={14} />
        </div>
      </div>
    </div>
  );
}
