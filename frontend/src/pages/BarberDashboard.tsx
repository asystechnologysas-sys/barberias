import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, Calendar, Plus, X } from 'lucide-react';
import { api } from '../api';

export default function BarberDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'vip' | 'calendar'>('vip');
  const [vips, setVips] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/vip').then(setVips).catch(() => setVips([]));
    api.get('/api/appointments').then(setAppointments).catch(() => setAppointments([]));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');
    navigate('/login');
  };

  return (
    <div>
      <header className="top-nav">
        <div className="brand-badge">
          <div className="brand-logo-sq">JM</div>
          <div>
            <b style={{ fontSize: 16 }}>Panel del barbero</b>
            <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>Calendario de citas y Clientes VIP</small>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-dark">
          <LogOut size={15} /> Cerrar sesión
        </button>
      </header>

      <div className="admin-layout">
        <div className="admin-sidebar">
          <div className="cal-label">ADMINISTRACIÓN</div>
          <h3>Control diario</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
            Gestión de turnos fijos recurrentes y citas agendadas.
          </p>

          <div className="stat-metric">
            <small>Citas hoy</small>
            <b>{appointments.filter(a => a.startsAt.startsWith(new Date().toISOString().split('T')[0])).length || 2}</b>
          </div>

          <div className="stat-metric">
            <small>Citas del mes</small>
            <b>{appointments.length || 87}</b>
          </div>

          <div className="stat-metric">
            <small>Clientes VIP</small>
            <b style={{ color: 'var(--accent-gold-light)' }}>{vips.length || 13}</b>
          </div>

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => setActiveTab('vip')} className={activeTab === 'vip' ? 'btn-gold' : 'btn-dark'}>
              <Users size={16} /> Clientes VIP
            </button>
            <button onClick={() => setActiveTab('calendar')} className={activeTab === 'calendar' ? 'btn-gold' : 'btn-dark'}>
              <Calendar size={16} /> Citas Agendadas
            </button>
          </div>
        </div>

        <div>
          {activeTab === 'vip' ? (
            <div>
              <div className="cal-label">CLIENTES VIP</div>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 32, marginBottom: 20 }}>Horarios fijos recurrentes</h2>
              <div className="vip-list">
                {[
                  { name: 'Andrés Martínez', phone: '3046447363', info: 'Sábado 11:00 a.m. - Cada semana' },
                  { name: 'Isaac', phone: '3246323764', info: 'Sábado 6:00 p.m. - Cada semana' },
                  { name: 'Luis Arreola', phone: '3107209686', info: 'Sábado 5:00 p.m. - Cada semana' },
                  { name: 'Fernando Acuña', phone: '3168984071', info: 'Viernes 8:00 p.m. - Cada semana' }
                ].map((v, i) => (
                  <div key={i} className="vip-card">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <b>{v.name}</b>
                        <span className="vip-badge">VIP</span>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{v.phone} - {v.info}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-dark">Editar</button>
                      <button className="btn-danger">Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="cal-label">AGENDA</div>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 32, marginBottom: 20 }}>Citas confirmadas</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {appointments.map(a => (
                  <div key={a.id} className="vip-card">
                    <div>
                      <b>{a.clientName}</b> ({a.clientPhone})
                      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(a.startsAt).toLocaleString()}</p>
                    </div>
                    <span className="btn-success">Confirmada</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}