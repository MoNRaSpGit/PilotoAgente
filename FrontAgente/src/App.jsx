import { Container, Nav, Navbar } from 'react-bootstrap';
import { Barcode, BotMessageSquare } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import CajaPage from './pages/CajaPage';
import GastosPage from './pages/GastosPage';
import LoginPage from './pages/LoginPage';
import ScannerPage from './pages/ScannerPage';
import { clearSession } from './store/slices/authSlice';
import { clearAuthSession } from './utils/authSession';
import './styles/app.css';

function RoleGate({ children, allow = ['admin'] }) {
  const userRole = useSelector((state) => state.auth.user?.role);

  if (!userRole || !allow.includes(userRole)) {
    return <Navigate to="/scanner" replace />;
  }

  return children;
}

function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const userRole = useSelector((state) => state.auth.user?.role);
  const isAdmin = userRole === 'admin';
  const isLoggedIn = Boolean(userRole);
  const homePath = isAdmin ? '/' : '/scanner';

  const handleLogout = () => {
    dispatch(clearSession());
    clearAuthSession();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <Navbar expand="lg" className="app-navbar" sticky="top" collapseOnSelect>
        <Container>
          <Navbar.Brand as={NavLink} to={homePath} className="brand">
            <BotMessageSquare size={20} />
            <span>FrontAgente</span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="app-navbar-nav" />
          <Navbar.Collapse id="app-navbar-nav">
            <Nav className="ms-auto app-nav-links">
              {isAdmin ? (
                <>
                  <Nav.Link as={NavLink} to="/" end>
                    Dashboard
                  </Nav.Link>
                  <Nav.Link as={NavLink} to="/clientes">
                    Clientes
                  </Nav.Link>
                  <Nav.Link as={NavLink} to="/gastos">
                    Gastos
                  </Nav.Link>
                </>
              ) : null}
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
                <Nav.Link as="button" type="button" onClick={handleLogout} className="nav-logout-link">
                  Salir
                </Nav.Link>
              ) : (
                <Nav.Link as={NavLink} to="/login">
                  Login
                </Nav.Link>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <main className="app-main">
        <Container>
          <Routes>
            <Route
              path="/"
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
                <RoleGate allow={['admin', 'operario']}>
                  <CajaPage />
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
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Container>
      </main>
    </div>
  );
}

export default App;
