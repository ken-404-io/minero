import Skeleton from "@/components/Skeleton";

export default function EarningsLoading() {
  return (
    <div
      className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8"
      aria-busy="true"
      role="status"
      aria-label="Loading earnings"
    >
      <header className="mb-6 lg:mb-8">
        <Skeleton width={64} height={12} style={{ marginBottom: 8 }} />
        <Skeleton width={160} height={28} style={{ marginBottom: 6 }} />
        <Skeleton width={220} height={14} />
      </header>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi">
            <Skeleton width={90} height={12} style={{ marginBottom: 8 }} />
            <Skeleton width={100} height={22} />
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width={72} height={28} radius={14} />
        ))}
      </div>

      {/* Earnings rows */}
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <li
            key={i}
            className="card flex items-center gap-3"
            style={{ padding: "12px 14px" }}
          >
            <Skeleton width={36} height={36} radius={8} />
            <div className="flex-1 min-w-0">
              <Skeleton width="55%" height={14} style={{ marginBottom: 6 }} />
              <Skeleton width="30%" height={12} />
            </div>
            <Skeleton width={72} height={16} />
          </li>
        ))}
      </ul>
    </div>
  );
}
