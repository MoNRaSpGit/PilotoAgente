import { useMemo } from 'react';
import { DASHBOARD_EMPTY_COPY } from './dashboardPage.utils';

export function useDashboardPageController() {
  const emptyState = useMemo(() => DASHBOARD_EMPTY_COPY, []);

  return {
    emptyState
  };
}
