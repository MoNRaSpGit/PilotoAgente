import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { normalizeRole } from './roleGate.utils';

export function RoleGate({ children, allow = ['admin'] }) {
  const userRole = normalizeRole(useSelector((state) => state.auth.user?.role));
  const allowedRoles = allow.map((role) => normalizeRole(role));

  if (!userRole) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={userRole === 'admin' ? '/caja' : '/scanner'} replace />;
  }

  return children;
}
