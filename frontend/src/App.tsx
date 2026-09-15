import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PublicBooking from './pages/PublicBooking';
import BarberDashboard from './pages/BarberDashboard';
import SuperAdmin from './pages/SuperAdmin';
import Login from './pages/Login';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicBooking />} />
        <Route path="/b/:slug" element={<PublicBooking />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<BarberDashboard />} />
        <Route path="/superadmin" element={<SuperAdmin />} />
      </Routes>
    </BrowserRouter>
  );
}