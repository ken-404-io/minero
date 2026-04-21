import Skeleton from "@/components/Skeleton";

export default function WithdrawLoading() {
  return (
    <div
      className="mx-auto max-w-[720px] px-4 py-6 lg:px-8 lg:py-8"
      aria-busy="true"
      role="status"
      aria-label="Loading withdraw"
    >
      <header className="mb-6 lg:mb-8">
        <Skeleton width={60} height={12} style={{ marginBottom: 8 }} />
        <Skeleton width={180} height={28} style={{ marginBottom: 6 }} />
        <Skeleton width={260} height={14} />
      </header>

      {/* Balance block */}
      <div className="card mb-6 flex flex-col gap-3">
        <Skeleton width={120} height={12} />
        <Skeleton width={160} height={36} />
        <Skeleton width={200} height={12} />
      </div>

      {/* Form */}
      <div className="card flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton width={100} height={12} style={{ marginBottom: 8 }} />
            <Skeleton width="100%" height={44} radius={8} />
          </div>
        ))}
        <Skeleton width="100%" height={48} radius={8} />
      </div>
    </div>
  );
}
