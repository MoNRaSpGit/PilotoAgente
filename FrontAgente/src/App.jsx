import { Button, Modal } from 'react-bootstrap';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { featureFlags } from './config/featureFlags';
import { AppNavbar } from './app/AppNavbar';
import { AppRoutes } from './app/AppRoutes';
import { normalizeRole } from './app/roleGate.utils';
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
import './styles/pages/stock.css';
import './styles/pages/suppliers.css';

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
