import Skeleton from "@/components/Skeleton";

export default function ReferralLoading() {
  return (
    <div
      className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8"
      aria-busy="true"
      role="status"
      aria-label="Loading referral"
    >
      <header className="mb-6 lg:mb-8">
        <Skeleton width={56} height={12} style={{ marginBottom: 8 }} />
        <Skeleton width={200} height={28} style={{ marginBottom: 6 }} />
        <Skeleton width={280} height={14} />
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi">
            <Skeleton width={90} height={12} style={{ marginBottom: 8 }} />
            <Skeleton width={70} height={22} />
          </div>
        ))}
      </div>

      {/* Share card */}
      <div className="card mb-6">
        <Skeleton width={140} height={18} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={44} radius={8} style={{ marginBottom: 10 }} />
        <div className="flex gap-2">
          <Skeleton width={120} height={36} radius={8} />
          <Skeleton width={120} height={36} radius={8} />
        </div>
      </div>

      {/* Referred users list */}
      <div>
        <Skeleton width={160} height={12} style={{ marginBottom: 12 }} />
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="card flex items-center gap-3"
              style={{ padding: "12px 14px" }}
            >
              <Skeleton width={36} height={36} radius={9999} />
              <div className="flex-1 min-w-0">
                <Skeleton width="50%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="30%" height={12} />
              </div>
              <Skeleton width={60} height={16} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
