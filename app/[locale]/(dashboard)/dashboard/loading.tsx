export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-40 bg-muted rounded animate-pulse" />
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 border rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  );
}
