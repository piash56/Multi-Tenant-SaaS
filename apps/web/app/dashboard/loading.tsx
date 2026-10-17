export default function DashboardLoading() {
  return (
    <div className="contentStack" aria-busy="true">
      <div className="skeleton skeletonTitle" />
      <div className="summaryGrid">
        <div className="skeleton skeletonCard" />
        <div className="skeleton skeletonCard" />
        <div className="skeleton skeletonCard" />
      </div>
      <span className="srOnly" role="status">
        Loading dashboard…
      </span>
    </div>
  );
}
