import Skeleton from "@/components/Skeleton";

export default function GameLoading() {
  return (
    <div
      className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8"
      aria-busy="true"
      role="status"
      aria-label="Loading games"
    >
      <header className="mb-6 lg:mb-8">
        <Skeleton width={40} height={12} style={{ marginBottom: 8 }} />
        <Skeleton width={140} height={28} style={{ marginBottom: 6 }} />
        <Skeleton width={220} height={14} />
      </header>

      {/* Combined stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi">
            <Skeleton width={100} height={12} style={{ marginBottom: 8 }} />
            <Skeleton width={80} height={22} />
          </div>
        ))}
      </div>

      {/* Redeem CTA */}
      <div className="card mb-6 flex items-center gap-3">
        <Skeleton width={44} height={44} radius={10} />
        <div className="flex-1 min-w-0">
          <Skeleton width="40%" height={16} style={{ marginBottom: 6 }} />
          <Skeleton width="60%" height={12} />
        </div>
        <Skeleton width={56} height={16} />
      </div>

      {/* Game list */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Skeleton width={44} height={44} radius={10} />
              <div className="flex-1 min-w-0">
                <Skeleton width="50%" height={16} style={{ marginBottom: 6 }} />
                <Skeleton width="35%" height={12} />
              </div>
              <Skeleton width={28} height={28} radius={8} />
            </div>
            <Skeleton width="95%" height={14} />
            <div className="hidden md:flex items-center justify-between pt-1">
              <Skeleton width={120} height={12} />
              <Skeleton width={80} height={14} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
