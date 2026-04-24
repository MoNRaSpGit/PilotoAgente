import { Button, Modal } from 'react-bootstrap';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { featureFlags } from './config/featureFlags';
import { AppNavbar } from './app/AppNavbar';
import { AppRoutes } from './app/AppRoutes';
import { normalizeRole } from './app/roleGate.utils';
import { useWebOrdersUnreadCounter } from './app/useWebOrdersUnreadCounter';
import {
  createWebOrdersBeepPlayer,
  loadWebOrdersSoundEnabled,
  loadWebOrdersSoundStyleId
} from './pages/webOrders/webOrdersAudioAlert';
import { clearSession } from './store/slices/authSlice';
import { clearAuthSession } from './utils/authSession';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages/caja.css';
import './styles/pages/clients.css';
import './styles/pages/gastos.css';
import './styles/pages/login.css';
import './styles/pages/objetivos.css';
import './styles/pages/scanner.css';
import './styles/pages/suppliers.css';
import './styles/pages/webOrders.css';

function supportsAppBadgeApi() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return (
    typeof navigator.setAppBadge === 'function'
    && typeof navigator.clearAppBadge === 'function'
  );
}

function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const userRole = normalizeRole(useSelector((state) => state.auth.user?.role));
  const isAdmin = userRole === 'admin';
  const isLoggedIn = Boolean(userRole);
  const homePath = isAdmin ? '/caja' : '/scanner';
  const hideNavbar = location.pathname === '/login';
  const dashboardEnabled = featureFlags.dashboardEnabled;
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const globalBeepPlayerRef = useRef(null);

  const getGlobalBeepPlayer = useCallback(() => {
    if (!globalBeepPlayerRef.current) {
      globalBeepPlayerRef.current = createWebOrdersBeepPlayer();
    }
    return globalBeepPlayerRef.current;
  }, []);

  const handleWebOrderCreatedAlert = useCallback(() => {
    if (!loadWebOrdersSoundEnabled()) {
      return;
    }

    const styleId = loadWebOrdersSoundStyleId();
    getGlobalBeepPlayer().playStyle(styleId);
  }, [getGlobalBeepPlayer]);

  const webOrdersUnreadCount = useWebOrdersUnreadCounter({
    enabled: isLoggedIn && (userRole === 'admin' || userRole === 'operario'),
    currentPath: location.pathname,
    onOrderCreated: handleWebOrderCreatedAlert
  });

  useEffect(() => () => {
    if (globalBeepPlayerRef.current) {
      globalBeepPlayerRef.current.destroy();
      globalBeepPlayerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!supportsAppBadgeApi()) {
      return;
    }

    const isOpsUser = userRole === 'admin' || userRole === 'operario';
    const onWebOrdersPage = String(location.pathname || '').toLowerCase() === '/web-pedidos';

    if (!isLoggedIn || !isOpsUser || onWebOrdersPage) {
      navigator.clearAppBadge().catch(() => {});
      return;
    }

    const safeCount = Math.max(0, Number(webOrdersUnreadCount || 0));
    if (safeCount > 0) {
      navigator.setAppBadge(safeCount).catch(() => {});
      return;
    }

    navigator.clearAppBadge().catch(() => {});
  }, [isLoggedIn, location.pathname, userRole, webOrdersUnreadCount]);

  const handleLogoutConfirm = () => {
    dispatch(clearSession());
    clearAuthSession();
    setLogoutConfirmOpen(false);
    navigate('/login', { replace: true, state: { resetLoginPanel: true, at: Date.now() } });
  };

  return (
    <div className="app-shell">
      {!hideNavbar ? (
        <AppNavbar
          homePath={homePath}
          isAdmin={isAdmin}
          isLoggedIn={isLoggedIn}
          dashboardEnabled={dashboardEnabled}
          webOrdersUnreadCount={webOrdersUnreadCount}
          onLogoutClick={() => setLogoutConfirmOpen(true)}
        />
      ) : null}

      <AppRoutes isLoggedIn={isLoggedIn} isAdmin={isAdmin} dashboardEnabled={dashboardEnabled} />

      <Modal show={logoutConfirmOpen} onHide={() => setLogoutConfirmOpen(false)} centered restoreFocus={false}>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar salida</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">Seguro que queres salir?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setLogoutConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={handleLogoutConfirm}>
            Salir
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default App;
