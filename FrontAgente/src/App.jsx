import { Container, Nav, Navbar } from 'react-bootstrap';
import { Barcode, BotMessageSquare } from 'lucide-react';
import { useSelector } from 'react-redux';
import { NavLink, Route, Routes } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import LoginPage from './pages/LoginPage';
import ScannerPage from './pages/ScannerPage';
import './styles/app.css';

function RoleGate({ children, allow = ['admin'] }) {
  const userRole = useSelector((state) => state.auth.user?.role);

  if (!userRole || !allow.includes(userRole)) {
    return <Navigate to="/scanner" replace />;
  }

  return children;
}

function App() {
  const userRole = useSelector((state) => state.auth.user?.role);
  const isAdmin = userRole === 'admin';

  return (
    <div className="app-shell">
      <Navbar expand="lg" className="app-navbar" sticky="top" collapseOnSelect>
        <Container>
          <Navbar.Brand as={NavLink} to="/" className="brand">
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
                </>
              ) : null}
              <Nav.Link as={NavLink} to="/scanner">
                <span className="nav-icon-wrap">
                  <Barcode size={16} />
                  Escaner
                </span>
              </Nav.Link>
              <Nav.Link as={NavLink} to="/login">
                Login
              </Nav.Link>
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
            <Route path="/scanner" element={<ScannerPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Container>
      </main>
    </div>
  );
}

export default App;
