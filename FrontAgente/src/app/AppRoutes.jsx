import { Container } from 'react-bootstrap';
import { Navigate, Route, Routes } from 'react-router-dom';
import CajaPage from '../pages/CajaPage';
import ClientsPage from '../pages/ClientsPage';
import DashboardPage from '../pages/DashboardPage';
import GastosPage from '../pages/GastosPage';
import LoginPage from '../pages/LoginPage';
import ObjetivosPage from '../pages/ObjetivosPage';
import RegPedidosPage from '../pages/RegPedidosPage';
import ScannerPage from '../pages/ScannerPage';
import SuppliersPage from '../pages/SuppliersPage';
import WebPedidosPage from '../pages/WebPedidosPage';
import { RoleGate } from './RoleGate';

export function AppRoutes({ isLoggedIn, isAdmin, dashboardEnabled }) {
  return (
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
              dashboardEnabled ? (
                <RoleGate allow={['admin']}>
                  <DashboardPage />
                </RoleGate>
              ) : (
                <Navigate to={isAdmin ? '/caja' : '/scanner'} replace />
              )
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
            path="/reg-pedidos"
            element={
              <RoleGate allow={['operario']}>
                <RegPedidosPage />
              </RoleGate>
            }
          />
          <Route
            path="/web-pedidos"
            element={
              <RoleGate allow={['admin', 'operario']}>
                <WebPedidosPage />
              </RoleGate>
            }
          />
          <Route
            path="/proveedores"
            element={
              <RoleGate allow={['admin']}>
                <SuppliersPage />
              </RoleGate>
            }
          />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </Container>
    </main>
  );
}
