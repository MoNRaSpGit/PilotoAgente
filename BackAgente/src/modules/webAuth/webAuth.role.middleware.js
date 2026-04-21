function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

export function requireWebRole(...allowedRoles) {
  const normalizedAllowedRoles = allowedRoles.map((role) => normalizeRole(role)).filter(Boolean);

  return function requireWebRoleMiddleware(req, res, next) {
    const userRole = normalizeRole(req.webUser?.role);
    if (!userRole || !normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'No autorizado para esta accion' });
    }
    return next();
  };
}
