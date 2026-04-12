import { Button, Container, Modal, Nav, Navbar } from 'react-bootstrap';
import { Barcode, BotMessageSquare, Target } from 'lucide-react';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import CajaPage from './pages/CajaPage';
import GastosPage from './pages/GastosPage';
import LoginPage from './pages/LoginPage';
import ObjetivosPage from './pages/ObjetivosPage';
import ScannerPage from './pages/ScannerPage';
import StockPage from './pages/StockPage';
import SuppliersPage from './pages/SuppliersPage';
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

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function RoleGate({ children, allow = ['admin'] }) {
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

function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const userRole = normalizeRole(useSelector((state) => state.auth.user?.role));
  const isAdmin = userRole === 'admin';
  const isLoggedIn = Boolean(userRole);
  const homePath = isAdmin ? '/caja' : '/scanner';
  const hideNavbar = location.pathname === '/login';
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
        <Navbar className="app-navbar" sticky="top">
          <Container>
            <Navbar.Brand as={NavLink} to={homePath} className="brand">
              <BotMessageSquare size={20} />
              <span>FrontAgente</span>
            </Navbar.Brand>
            <Nav className="ms-auto app-nav-links">
              {isAdmin ? (
                <>
                  <Nav.Link as={NavLink} to="/clientes">
                    Clientes
                  </Nav.Link>
                  <Nav.Link as={NavLink} to="/gastos">
                    Gastos
                  </Nav.Link>
                  <Nav.Link as={NavLink} to="/stock">
                    Stock
                  </Nav.Link>
                  <Nav.Link as={NavLink} to="/proveedores">
                    Proveedores
                  </Nav.Link>
                </>
              ) : (
                <>
                  <Nav.Link as={NavLink} to="/objetivos">
                    <span className="nav-icon-wrap">
                      <Target size={16} />
                      Objetivos
                    </span>
                  </Nav.Link>
                  <Nav.Link as={NavLink} to="/stock">
                    Stock
                  </Nav.Link>
                  <Nav.Link as={NavLink} to="/proveedores">
                    Proveedores
                  </Nav.Link>
                </>
              )}
              <Nav.Link as={NavLink} to="/scanner">
                <span className="nav-icon-wrap">
                  <Barcode size={16} />
                  Escaner
                </span>
              </Nav.Link>
              {isAdmin ? (
                <Nav.Link as={NavLink} to="/caja">
                  Caja
                </Nav.Link>
              ) : null}
              {isLoggedIn ? (
                <Nav.Link as="button" type="button" onClick={() => setLogoutConfirmOpen(true)} className="nav-logout-link">
                  Salir
                </Nav.Link>
              ) : (
                <Nav.Link as={NavLink} to="/login">
                  Login
                </Nav.Link>
              )}
            </Nav>
          </Container>
        </Navbar>
      ) : null}

      <main className="app-main">
        <Container>
          <Routes>
            <Route
              path="/"
              element={<Navigate to={isLoggedIn ? (isAdmin ? '/caja' : '/scanner') : '/login'} replace />}
            />
            <Route
              path="/dashboard"
              element={
                <RoleGate allow={['admin']}>
                  <DashboardPage />
                </RoleGate>
              }
            />
            <Route
              path="/clientes"
              element={
                <RoleGate allow={['admin']}>
                  <ClientsPage />
                </RoleGate>
              }
            />
            <Route
              path="/caja"
              element={
                <RoleGate allow={['admin']}>
                  <CajaPage />
                </RoleGate>
              }
            />
            <Route
              path="/objetivos"
              element={
                <RoleGate allow={['operario']}>
                  <ObjetivosPage />
                </RoleGate>
              }
            />
            <Route
              path="/gastos"
              element={
                <RoleGate allow={['admin']}>
                  <GastosPage />
                </RoleGate>
              }
            />
            <Route
              path="/scanner"
              element={
                <RoleGate allow={['admin', 'operario']}>
                  <ScannerPage />
                </RoleGate>
              }
            />
            <Route
              path="/stock"
              element={
                <RoleGate allow={['admin', 'operario']}>
                  <StockPage />
                </RoleGate>
              }
            />
            <Route
              path="/proveedores"
              element={
                <RoleGate allow={['admin', 'operario']}>
                  <SuppliersPage />
                </RoleGate>
              }
            />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Container>
      </main>

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
