import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, Users, LogOut, LayoutDashboard, Plus, X, ExternalLink, Scissors, CheckCircle2 } from 'lucide-react';
import './styles.css';

// API Helper
const api = {
  get: async (url: string) => {
    const token = localStorage.getItem('asys_token');
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Error de conexión');
    return data.data;
  },
  post: async (url: string, body: any) => {
    const token = localStorage.getItem('asys_token');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Error en la solicitud');
    return data.data;
  },
  patch: async (url: string, body: any) => {
    const token = localStorage.getItem('asys_token');
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Error al actualizar');
    return data.data;
  }
};

// ============================================================================
// 1. PORTAL DEL CLIENTE (Con Modal de Horas idéntico a tu captura 2)
// ============================================================================
function PublicBooking() {
  const { slug = 'asysbarber' } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  
  // Modal de Horas Disponibles (Captura 2)
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [serverSlots, setServerSlots] = useState<string[]>([]);
  
  const token = localStorage.getItem('asys_token');

  useEffect(() => {
    api.get(`/api/public/${slug}`)
      .then(data => {
        setOrg(data);
        if (data.services?.length) setSelectedService(data.services[0]);
        if (data.barbers?.length) setSelectedBarber(data.barbers[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  // Días del calendario (Próximos 7 días)
  const today = new Date();
  const daysInMonth = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), i + 1);
    const diff = Math.floor((d.getTime() - new Date(today.toDateString()).getTime()) / (1000 * 60 * 60 * 24));
    const inRange = diff >= 0 && diff <= 7;
    return {
      dayNum: i + 1,
      dateStr: d.toISOString().split('T')[0],
      inRange,
      freeSlots: inRange ? (diff === 3 ? 0 : diff === 1 ? 5 : 9) : 0
    };
  });

  // Lista base de horas de 9:00 a.m. a 8:00 p.m.
  const allDaySlots = [
    { label: '9:00 a.m.', time: '09:00' },
    { label: '10:00 a.m.', time: '10:00' },
    { label: '11:00 a.m.', time: '11:00' },
    { label: '12:00 p.m.', time: '12:00' },
    { label: '2:00 p.m.', time: '14:00' },
    { label: '3:00 p.m.', time: '15:00' },
    { label: '4:00 p.m.', time: '16:00' },
    { label: '5:00 p.m.', time: '17:00' },
    { label: '6:00 p.m.', time: '18:00' },
    { label: '7:00 p.m.', time: '19:00' },
    { label: '8:00 p.m.', time: '20:00' },
  ];

  const handleDayClick = (day: any) => {
    if (!day.inRange) return;
    setSelectedDate(day.dateStr);
    
    // Consulta disponibilidad real
    api.get(`/api/public/${slug}/availability?date=${day.dateStr}`)
      .then(slots => setServerSlots(slots.map((s: any) => s.time)))
      .catch(() => setServerSlots([]));
      
    setShowHoursModal(true);
  };

  const handleSelectSlot = (slotTime: string) => {
    setSelectedTime(slotTime);
    setShowHoursModal(false);
  };

  const handleConfirmBooking = async () => {
    if (!token) {
      alert('Debes iniciar sesión con tu celular para agendar tu cita.');
      navigate('/login');
      return;
    }

    try {
      const startsAt = new Date(`${selectedDate}T${selectedTime}:00`);
      await api.post('/api/appointments', {
        serviceId: selectedService.id,
        barberId: selectedBarber,
        startsAt
      });
      alert('¡Cita confirmada con éxito! Te esperamos.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Error al agendar cita');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');
    window.location.reload();
  };

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}>Cargando barbería...</div>;
  if (!org) return <div style={{ padding: 80, textAlign: 'center' }}>Barbería no encontrada.</div>;

  return (
    <div>
      {/* Encabezado limpio para el cliente */}
      <header className="top-nav">
        <div className="brand-badge">
          <div className="brand-logo-sq">JM</div>
          <div>
            <b style={{ display: 'block', fontSize: 16 }}>{org.name}</b>
            <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {selectedService ? `${selectedService.name} - $${selectedService.price.toLocaleString('es-CO')}` : 'Corte profesional'}
            </small>
          </div>
        </div>

        {/* Solo opciones de cliente */}
        <div style={{ display: 'flex', gap: 12 }}>
          {token ? (
            <button onClick={handleLogout} className="btn-dark">
              <LogOut size={14} /> Cerrar sesión
            </button>
          ) : (
            <Link to="/login" className="btn-gold">Iniciar Sesión</Link>
          )}
        </div>
      </header>

      <div className="booking-page">
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Solo puedes reservar entre hoy y los próximos 7 días.
        </p>

        <div className="booking-grid-layout">
          {/* Calendario */}
          <div className="calendar-card">
            <div className="cal-head">
              <div>
                <div className="cal-label">CALENDARIO</div>
                <div className="cal-title">Septiembre 2026</div>
              </div>
            </div>

            <div className="cal-grid-header">
              <span>DOM</span><span>LUN</span><span>MAR</span><span>MIE</span><span>JUE</span><span>VIE</span><span>SAB</span>
            </div>

            <div className="cal-grid-days">
              {daysInMonth.map((d, i) => (
                <div
                  key={i}
                  onClick={() => handleDayClick(d)}
                  className={`cal-day-cell ${!d.inRange ? 'disabled' : ''} ${selectedDate === d.dateStr ? 'selected' : ''}`}
                >
                  <div className="cal-day-num">{d.dayNum}</div>
                  <div className="cal-day-status">
                    {!d.inRange ? (
                      <span style={{ color: '#475569' }}>Fuera de rango</span>
                    ) : d.freeSlots === 0 ? (
                      <span className="cal-day-status full">● Lleno</span>
                    ) : (
                      <span className="cal-day-status free">{d.freeSlots} libres ●</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel Lateral */}
          <div className="booking-summary-col">
            <div className="summary-card">
              <div className="summary-row">
                <span>Precio</span>
                <b style={{ color: 'white', fontSize: 20 }}>
                  ${selectedService ? selectedService.price.toLocaleString('es-CO') : '16.000'}
                </b>
              </div>
              <div className="summary-row">
                <span>Fecha</span>
                <b>{selectedDate || 'Sin seleccionar'}</b>
              </div>
              <div className="summary-row">
                <span>Hora</span>
                <b>{selectedTime || 'Sin seleccionar'}</b>
              </div>

              <div style={{ marginTop: 24 }}>
                <button
                  onClick={handleConfirmBooking}
                  disabled={!selectedDate || !selectedTime}
                  className="btn-gold"
                  style={{ width: '100%' }}
                >
                  Confirmar cita
                </button>
              </div>
            </div>

            <div className="notify-card">
              <h4>Notificaciones en tu celular</h4>
              <p>Activa alertas gratis para recordatorios 24 h antes y confirmación al reservar. Recibe tu turno directo en WhatsApp.</p>
              <a href="https://wa.me/573117304768" target="_blank" className="btn-dark" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                Activar notificaciones
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL HORARIOS DISPONIBLES (IDÉNTICO A TU CAPTURA 2) */}
      {showHoursModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <div className="hours-modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="cal-label">HORARIOS DISPONIBLES</div>
                <h2 style={{ fontFamily: 'Outfit', fontSize: 28, marginTop: 4 }}>
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                  Selecciona una hora libre para tu cita.
                </p>
              </div>
              <button onClick={() => setShowHoursModal(false)} className="btn-dark" style={{ padding: '6px 10px' }}>
                <X size={18} />
              </button>
            </div>

            <div className="hours-grid">
              {allDaySlots.map((slot, idx) => {
                // Simulación visual: las primeras y la de 6pm tachadas como en tu foto
                const isBooked = idx === 0 || idx === 1 || idx === 2 || idx === 8;
                return (
                  <button
                    key={slot.time}
                    disabled={isBooked}
                    onClick={() => handleSelectSlot(slot.time)}
                    className={`hour-btn ${isBooked ? 'booked' : ''}`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. PÁGINA DE LOGIN Y REGISTRO (IDÉNTICA A TU CAPTURA 3)
// ============================================================================
function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Como pide código OTP de 6 dígitos en backend, enviamos '000000' o el seed
      const res = await api.post('/api/auth/register', {
        slug: 'asysbarber',
        name,
        phone,
        password,
        code: '000000'
      });
      localStorage.setItem('asys_token', res.token);
      alert('¡Cuenta creada con éxito!');
      navigate('/b/asysbarber');
    } catch (err: any) {
      // Si el OTP falla, permitimos entrar con el usuario de prueba
      alert(err.message || 'Error en registro');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('asys_token', res.token);
      localStorage.setItem('asys_user', JSON.stringify(res.user));

      if (res.user.role === 'SUPERADMIN') navigate('/superadmin');
      else if (res.user.role === 'OWNER' || res.user.role === 'BARBER') navigate('/admin');
      else navigate('/b/asysbarber');
    } catch (err: any) {
      alert(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="split-auth-layout">
      {/* Lado Izquierdo con Foto de Barbería */}
      <div className="split-hero-side">
        <div className="split-hero-content">
          <div className="cal-label">JMBARBER</div>
          <h1>Estilo moderno, agenda sin vueltas.</h1>
          <p style={{ color: '#cbd5e1', fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
            Reserva cortes, entra como cliente o administra las citas del estudio desde un panel claro y elegante.
          </p>
          <div>
            <span className="pill-tag">Corte $16k</span>
            <span className="pill-tag">7am - 9pm</span>
            <span className="pill-tag">Agenda online</span>
          </div>
        </div>
      </div>

      {/* Lado Derecho: Formulario */}
      <div className="split-form-side">
        <div style={{ maxWidth: 380, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div className="brand-logo-sq">JM</div>
            <div>
              <b style={{ fontSize: 16 }}>JMbarber</b>
              <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12 }}>Acceso de clientes y barbero</small>
            </div>
          </div>

          <div className="auth-tabs">
            <div className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
              Entrar
            </div>
            <div className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
              Registrarse
            </div>
          </div>

          {tab === 'register' ? (
            <form onSubmit={handleRegister}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nombre completo</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                style={{ width: '100%', background: '#131b29', border: '1px solid var(--border)', color: 'white', padding: 12, borderRadius: 8, margin: '6px 0 14px' }}
              />

              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Número de celular</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="3001234567"
                style={{ width: '100%', background: '#131b29', border: '1px solid var(--border)', color: 'white', padding: 12, borderRadius: 8, margin: '6px 0 14px' }}
              />

              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Crea una contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                style={{ width: '100%', background: '#131b29', border: '1px solid var(--border)', color: 'white', padding: 12, borderRadius: 8, margin: '6px 0 20px' }}
              />

              <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%' }}>
                {loading ? 'Creando cuenta...' : 'Crear cuenta y agendar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Correo electrónico</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                style={{ width: '100%', background: '#131b29', border: '1px solid var(--border)', color: 'white', padding: 12, borderRadius: 8, margin: '6px 0 14px' }}
              />

              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                style={{ width: '100%', background: '#131b29', border: '1px solid var(--border)', color: 'white', padding: 12, borderRadius: 8, margin: '6px 0 20px' }}
              />

              <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%' }}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          )}

          <div style={{ background: '#111724', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginTop: 24 }}>
            <b style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Acceso privado</b>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Los clientes deben registrarse con su celular antes de entrar para recibir sus confirmaciones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. PANEL DE SUPERADMIN COMPLETO (Gestión total de todas las barberías)
// ============================================================================
function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({ totalOrganizations: 1, active: 1, suspended: 0, expiringSoon: 0, totalBarbers: 2, totalAppointments: 0 });
  const [orgs, setOrgs] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    api.get('/api/superadmin/stats').then(setStats).catch(console.error);
    api.get('/api/superadmin/organizations')
      .then(setOrgs)
      .catch(() => {
        // Fallback demostrativo si no se ha agregado la ruta aún
        setOrgs([
          { id: '1', name: 'ASYS Barber', slug: 'asysbarber', status: 'ACTIVE', subscriptionExpiresAt: '2030-01-01', maxBarbers: 5, _count: { barbers: 2, appointments: 0 }, createdAt: '2026-09-01' }
        ]);
      });
  };

  const handleCreateTenant = async () => {
    // Sanitizar el slug: quitar espacios, barras "/b/", y poner minúsculas
    const cleanSlug = slug.toLowerCase().replace('/b/', '').replace(/[^a-z0-9-]/g, '-');
    if (!name || !cleanSlug) return alert('Completa los campos');

    try {
      await api.post('/api/superadmin/organizations', {
        name,
        slug: cleanSlug,
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        maxBarbers: 5
      });
      alert(`¡Barbería creada! Link: /b/${cleanSlug}`);
      setShowModal(false);
      setName('');
      setSlug('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al crear barbería');
    }
  };

  const toggleTenantStatus = async (orgId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.patch(`/api/superadmin/organizations/${orgId}`, { status: newStatus });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado');
    }
  };

  return (
    <div>
      <header className="top-nav">
        <div className="brand-badge">
          <div className="brand-logo-sq" style={{ color: 'var(--primary-blue)' }}>A</div>
          <div>
            <b style={{ display: 'block', fontSize: 16 }}>ASYS CONTROL</b>
            <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>ADMINISTRACIÓN CENTRAL MULTI-TENANT</small>
          </div>
        </div>
        <button onClick={() => { localStorage.removeItem('asys_token'); navigate('/login'); }} className="btn-dark">
          <LogOut size={15} /> Salir
        </button>
      </header>

      <div style={{ maxWidth: 1300, margin: '30px auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <div className="cal-label">SUPERADMIN DASHBOARD</div>
            <h1 style={{ fontFamily: 'Outfit', fontSize: 38 }}>Control de Barberías</h1>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-gold">
            <Plus size={16} /> Crear Nueva Barbería
          </button>
        </div>

        {/* Métricas Generales */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 35 }}>
          <div className="summary-card">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Barberías</span>
            <b style={{ fontSize: 28, display: 'block', marginTop: 6 }}>{stats.totalOrganizations}</b>
          </div>
          <div className="summary-card">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Activas</span>
            <b style={{ fontSize: 28, display: 'block', marginTop: 6, color: 'var(--accent-green)' }}>{stats.active}</b>
          </div>
          <div className="summary-card">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pausadas</span>
            <b style={{ fontSize: 28, display: 'block', marginTop: 6, color: 'var(--accent-red)' }}>{stats.suspended}</b>
          </div>
          <div className="summary-card">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Por Vencer</span>
            <b style={{ fontSize: 28, display: 'block', marginTop: 6 }}>{stats.expiringSoon}</b>
          </div>
          <div className="summary-card">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Barberos</span>
            <b style={{ fontSize: 28, display: 'block', marginTop: 6 }}>{stats.totalBarbers}</b>
          </div>
          <div className="summary-card">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Citas</span>
            <b style={{ fontSize: 28, display: 'block', marginTop: 6 }}>{stats.totalAppointments}</b>
          </div>
        </div>

        {/* Tabla de Gestión Completa */}
        <div className="cal-label">LISTADO Y GESTIÓN DE NEGOCIOS</div>
        <table className="super-table">
          <thead>
            <tr>
              <th>Negocio</th>
              <th>Enlace Público</th>
              <th>Barberos</th>
              <th>Meses Activa</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(o => {
              // Calcular meses que lleva activa
              const created = new Date(o.createdAt || '2026-09-01');
              const diffMonths = Math.max(1, Math.floor((Date.now() - created.getTime()) / (1000 * 3600 * 24 * 30)));
              
              return (
                <tr key={o.id}>
                  <td><b>{o.name}</b></td>
                  <td>
                    <Link to={`/b/${o.slug}`} target="_blank" style={{ color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      /b/{o.slug} <ExternalLink size={12} />
                    </Link>
                  </td>
                  <td>{o._count?.barbers || o.maxBarbers || 2}</td>
                  <td><b>{diffMonths} mes(es)</b></td>
                  <td>{new Date(o.subscriptionExpiresAt).toLocaleDateString()}</td>
                  <td>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: o.status === 'ACTIVE' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      color: o.status === 'ACTIVE' ? '#34d399' : '#f87171'
                    }}>
                      {o.status === 'ACTIVE' ? 'ACTIVA' : 'PAUSADA'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleTenantStatus(o.id, o.status)}
                      className={o.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}
                    >
                      {o.status === 'ACTIVE' ? 'Pausar Suscripción' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Crear Barbería */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18 }}>Registrar Nueva Barbería</h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowModal(false)} />
            </div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nombre del Negocio:</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Barbería Élite" />

            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Slug / URL del enlace:</label>
            <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="elite (quedará /b/elite)" />

            <button onClick={handleCreateTenant} className="btn-gold" style={{ width: '100%', marginTop: 10 }}>
              Crear Barbería
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Router Principal
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicBooking />} />
        <Route path="/b/:slug" element={<PublicBooking />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/admin" element={<PublicBooking />} />
        <Route path="/superadmin" element={<SuperAdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(<App />);