export const QUICK_LOGINS = {
  admin: {
    email: 'adminnuevo@agente.dev',
    password: 'AdminNuevo2026!'
  },
  operario: {
    email: 'operario@agente.dev',
    password: 'OperarioDemo2026!'
  },
  operarioOficina: {
    email: 'operario.oficina@agente.dev',
    password: 'Oficina2026!'
  }
};

export function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}
