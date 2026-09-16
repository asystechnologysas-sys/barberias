import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import SuperAdmin from './pages/SuperAdmin';
import BarberDashboard from './pages/BarberDashboard';
import PublicBooking from './pages/PublicBooking';

// Componente guardián: protege los paneles administrativos
function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode; allowedRole?: string }) {
  const token = localStorage.getItem('asys_token');
  const userStr = localStorage.getItem('asys_user');

  // Si no hay token guardado, redirigir al login obligatoriamente
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Si se exige un rol específico y no coincide, redirigir al login
  if (allowedRole && userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.role !== allowedRole && user.role !== 'SUPERADMIN') {
        return <Navigate to="/login" replace />;
      }
    } catch {
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* La ruta principal AHORA SIEMPRE envía al login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Pantalla oficial de Login */}
        <Route path="/login" element={<Login />} />

        {/* Portal de agendamiento para clientes */}
        <Route path="/b/:slug" element={<PublicBooking />} />

        {/* Panel del Barbero (PROTEGIDO: Requiere sesión) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <BarberDashboard />
            </ProtectedRoute>
          }
        />

        {/* Panel Central Superadmin (PROTEGIDO: Solo SUPERADMIN) */}
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute allowedRole="SUPERADMIN">
              <SuperAdmin />
            </ProtectedRoute>
          }
        />

        {/* Cualquier otra ruta redirige al login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}