export function DashboardPlaceholderPanel({ emptyState }) {
  return (
    <div className="hero-panel dashboard-empty-panel">
      <p className="eyebrow">{emptyState.eyebrow}</p>
      <h1>{emptyState.title}</h1>
      <p>{emptyState.description}</p>
    </div>
  );
}
