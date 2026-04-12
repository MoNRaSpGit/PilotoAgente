import { DashboardPlaceholderPanel } from './dashboard/components/DashboardPlaceholderPanel';
import { useDashboardPageController } from './dashboard/useDashboardPageController';

function DashboardPage() {
  const { emptyState } = useDashboardPageController();

  return (
    <section className="page-section dashboard-empty">
      <DashboardPlaceholderPanel emptyState={emptyState} />
    </section>
  );
}

export default DashboardPage;
