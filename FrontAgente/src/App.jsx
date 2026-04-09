import { Container, Nav, Navbar } from 'react-bootstrap';
import { Barcode, BotMessageSquare } from 'lucide-react';
import { NavLink, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import ScannerPage from './pages/ScannerPage';
import './styles/app.css';

function App() {
  return (
    <div className="app-shell">
      <Navbar expand="lg" className="app-navbar" sticky="top">
        <Container>
          <Navbar.Brand as={NavLink} to="/" className="brand">
            <BotMessageSquare size={20} />
            <span>FrontAgente</span>
          </Navbar.Brand>
          <Nav className="ms-auto">
            <Nav.Link as={NavLink} to="/">
              Dashboard
            </Nav.Link>
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
        </Container>
      </Navbar>

      <main className="app-main">
        <Container>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/scanner" element={<ScannerPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Container>
      </main>
    </div>
  );
}

export default App;
