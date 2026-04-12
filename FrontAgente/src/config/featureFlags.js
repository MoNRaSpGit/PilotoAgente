function parseBooleanFlag(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

export const featureFlags = {
  dashboardEnabled: parseBooleanFlag(import.meta.env.VITE_FEATURE_DASHBOARD)
};
