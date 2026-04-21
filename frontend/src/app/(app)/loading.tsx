import Skeleton from "@/components/Skeleton";

export default function AppLoading() {
  return (
    <div
      className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8"
      aria-busy="true"
      role="status"
      aria-label="Loading"
    >
      <header className="mb-6 lg:mb-8">
        <Skeleton width={56} height={12} style={{ marginBottom: 8 }} />
        <Skeleton width={200} height={28} style={{ marginBottom: 6 }} />
        <Skeleton width={260} height={14} />
      </header>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi">
            <Skeleton width={80} height={12} style={{ marginBottom: 8 }} />
            <Skeleton width={100} height={20} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card">
            <Skeleton width={140} height={18} style={{ marginBottom: 8 }} />
            <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} />
            <Skeleton width="70%" height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}
