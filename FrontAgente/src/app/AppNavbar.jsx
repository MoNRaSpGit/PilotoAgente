import { Container, Nav, Navbar } from 'react-bootstrap';
import { Barcode, BotMessageSquare, Target } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export function AppNavbar({
  homePath,
  isAdmin,
  isLoggedIn,
  dashboardEnabled,
  onLogoutClick
}) {
  return (
    <Navbar className="app-navbar" sticky="top">
      <Container>
        <Navbar.Brand as={NavLink} to={homePath} className="brand">
          <BotMessageSquare size={20} />
          <span>FrontAgente</span>
        </Navbar.Brand>
        <Nav className="ms-auto app-nav-links">
          {isAdmin ? (
            <>
              {dashboardEnabled ? (
                <Nav.Link as={NavLink} to="/dashboard">
                  Dashboard
                </Nav.Link>
              ) : null}
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
            <Nav.Link as="button" type="button" onClick={onLogoutClick} className="nav-logout-link">
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
  );
}
