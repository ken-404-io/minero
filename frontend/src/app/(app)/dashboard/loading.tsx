import Skeleton from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div
      className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8"
      aria-busy="true"
      role="status"
      aria-label="Loading dashboard"
    >
      <header className="mb-6 lg:mb-8">
        <Skeleton width={48} height={12} style={{ marginBottom: 8 }} />
        <Skeleton width={180} height={28} style={{ marginBottom: 6 }} />
        <Skeleton width={240} height={14} />
      </header>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi">
            <Skeleton width={90} height={12} style={{ marginBottom: 8 }} />
            <Skeleton width={110} height={22} />
          </div>
        ))}
      </div>

      {/* Claim button block */}
      <div
        className="card mb-6 flex flex-col items-center gap-4"
        style={{ padding: "28px 20px" }}
      >
        <Skeleton width={160} height={14} />
        <Skeleton width={180} height={180} radius={9999} />
        <Skeleton width={220} height={14} />
      </div>

      {/* Two-column lower blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card">
            <Skeleton width={140} height={18} style={{ marginBottom: 10 }} />
            <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} />
            <Skeleton width="70%" height={14} style={{ marginBottom: 12 }} />
            <Skeleton width={120} height={36} radius={8} />
          </div>
        ))}
      </div>
    </div>
  );
}
