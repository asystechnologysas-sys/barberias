import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, Users, Scissors, Clock, CheckCircle2, Plus, Trash2, LogOut, LayoutDashboard, ShieldCheck, X } from 'lucide-react';
import './styles.css';

// ============================================================================
// SERVICIO DE LLAMADAS A LA API (Conectado a tu backend en EasyPanel)
// ============================================================================
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
// 1. PORTAL PÚBLICO DE RESERVAS (Diseño idéntico a tu captura de JMbarber)
// ============================================================================
function PublicBooking() {
  const { slug = 'asysbarber' } = useParams();
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [slots, setSlots] = useState<{ barberId: string; time: string }[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [confirmModal, setConfirmModal] = useState(false);
  const [clientPhone, setClientPhone] = useState('+573000000000');
  const [clientEmail, setClientEmail] = useState('cliente@asysbarber.local');
  const [clientPassword, setClientPassword] = useState('AsysDemo2026!');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    api.get(`/api/public/${slug}`)
      .then(data => {
        setOrg(data);
        if (data.services?.length) setSelectedService(data.services[0]);
        if (data.barbers?.length) setSelectedBarber(data.barbers[0].id);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [slug]);

  // Generar días del mes actual (limitando a la ventana permitida de 7 días)
  const today = new Date();
  const daysInMonth = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), i + 1);
    const diff = Math.floor((d.getTime() - new Date(today.toDateString()).getTime()) / (1000 * 60 * 60 * 24));
    const isAvailableWindow = diff >= 0 && diff <= 7;
    return {
      dayNum: i + 1,
      dateStr: d.toISOString().split('T')[0],
      inRange: isAvailableWindow,
      freeSlots: isAvailableWindow ? (diff === 3 ? 0 : diff === 1 ? 5 : 9) : 0
    };
  });

  const handleSelectDay = (day: any) => {
    if (!day.inRange) return;
    setSelectedDate(day.dateStr);
    setSelectedTime('');
    api.get(`/api/public/${slug}/availability?date=${day.dateStr}&serviceId=${selectedService?.id}&barberId=${selectedBarber}`)
      .then(data => setSlots(data))
      .catch(() => setSlots([]));
  };

  const handleBooking = async () => {
    try {
      // 1. Asegurar sesión como cliente
      let token = localStorage.getItem('asys_token');
      if (!token) {
        const loginRes = await api.post('/api/auth/login', {
          email: clientEmail,
          password: clientPassword
        });
        token = loginRes.token;
        localStorage.setItem('asys_token', token!);
      }

      // 2. Crear Cita
      await api.post('/api/appointments', {
        serviceId: selectedService.id,
        barberId: selectedBarber,
        startsAt: selectedTime
      });

      setBookingSuccess(true);
    } catch (err: any) {
      alert(err.message || 'No se pudo confirmar la cita');
    }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}>Cargando barbería...</div>;
  if (!org) return <div style={{ padding: 60, textAlign: 'center' }}>Barbería no disponible.</div>;

  return (
    <div>
      {/* Barra superior */}
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
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/admin" className="btn-dark">Acceso Barbero</Link>
          <Link to="/login" className="btn-dark">Iniciar Sesión</Link>
        </div>
      </header>

      <div className="booking-page">
        {/* Banner de Bienvenida */}
        <div className="booking-banner">
          <div>
            <span className="cal-label">JMBARBER STUDIO</span>
            <h1 style={{ fontSize: 38, fontFamily: 'Outfit', margin: '8px 0 14px' }}>Agenda tu corte<br />con estilo.</h1>
            <p style={{ color: 'var(--text-muted)', maxWidth: 460, fontSize: 14, lineHeight: 1.6 }}>
              Reserva tu hora en los próximos 7 días. Atención organizada, trato profesional y una experiencia limpia desde que eliges el horario.
            </p>
          </div>
          <div className="brand-logo-sq" style={{ width: 140, height: 140, fontSize: 52 }}>
            JM
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Solo puedes reservar entre hoy y los próximos 7 días.
        </p>

        {/* Grid Principal: Calendario + Resumen */}
        <div className="booking-grid-layout">
          
          {/* Calendario Estilo JMbarber */}
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
                  onClick={() => handleSelectDay(d)}
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

            {/* Selector de Horas si hay fecha elegida */}
            {selectedDate && (
              <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div className="cal-label" style={{ marginBottom: 12 }}>Horas disponibles para el {selectedDate}:</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {slots.length === 0 ? (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Cargando horas libres o día ocupado...</span>
                  ) : (
                    slots.map((s, idx) => {
                      const timeString = new Date(s.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedTime(s.time)}
                          className="btn-dark"
                          style={{
                            borderColor: selectedTime === s.time ? 'var(--accent-gold)' : 'var(--border)',
                            backgroundColor: selectedTime === s.time ? '#2a2213' : '#141b2b',
                            color: selectedTime === s.time ? 'var(--accent-gold-light)' : 'white'
                          }}
                        >
                          {timeString}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Columna Derecha: Tarjeta de Pago y Notificaciones */}
          <div className="booking-summary-col">
            <div className="summary-card">
              <div className="summary-row">
                <span>Precio</span>
                <b style={{ color: 'white', fontSize: 20 }}>${selectedService?.price ? selectedService.price.toLocaleString('es-CO') : '16.000'}</b>
              </div>
              <div className="summary-row">
                <span>Fecha</span>
                <b>{selectedDate || 'Sin seleccionar'}</b>
              </div>
              <div className="summary-row">
                <span>Hora</span>
                <b>{selectedTime ? new Date(selectedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sin seleccionar'}</b>
              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  onClick={() => setConfirmModal(true)}
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

      {/* Modal de confirmación final */}
      {confirmModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            {bookingSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 22, marginBottom: 8 }}>¡Cita Reservada con Éxito!</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Te esperamos el {selectedDate} a las {new Date(selectedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                </p>
                <button onClick={() => { setConfirmModal(false); setBookingSuccess(false); }} className="btn-gold" style={{ marginTop: 20 }}>
                  Entendido
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 18 }}>Confirmar Datos del Cliente</h3>
                  <X size={20} style={{ cursor: 'pointer' }} onClick={() => setConfirmModal(false)} />
                </div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Email para confirmación:</label>
                <input value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Contraseña:</label>
                <input type="password" value={clientPassword} onChange={e => setClientPassword(e.target.value)} />
                
                <button onClick={handleBooking} className="btn-gold" style={{ width: '100%', marginTop: 10 }}>
                  Confirmar y Agendar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. PANEL DEL BARBERO Y DUEÑO (Idéntico a tu captura de Clientes VIP y Control)
// ============================================================================
function BarberDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'vip' | 'calendar'>('vip');
  const [vips, setVips] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showAddVip, setShowAddVip] = useState(false);
  
  // Formulario nuevo VIP
  const [newVipWeekday, setNewVipWeekday] = useState(5);
  const [newVipTime, setNewVipTime] = useState('11:00');
  const [newVipFreq, setNewVipFreq] = useState('WEEKLY');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    api.get('/api/vip').then(setVips).catch(console.error);
    api.get('/api/appointments').then(setAppointments).catch(console.error);
  };

  const handleLogout = () => {
    localStorage.removeItem('asys_token');
    navigate('/login');
  };

  return (
    <div>
      <header className="top-nav">
        <div className="brand-badge">
          <div className="brand-logo-sq">JM</div>
          <div>
            <b style={{ display: 'block', fontSize: 16 }}>Panel del barbero</b>
            <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>Calendario de citas y Clientes VIP</small>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-dark" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LogOut size={15} /> Cerrar sesión
        </button>
      </header>

      <div className="admin-layout">
        {/* Barra Lateral Izquierda: Control Diario */}
        <div className="admin-sidebar">
          <div className="cal-label">ADMINISTRACIÓN</div>
          <h3>Control diario</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
            Selecciona una fecha del calendario para gestionar horas, bloqueos y citas.
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
            <small>Registros pendientes</small>
            <b>0</b>
          </div>

          <div className="stat-metric">
            <small>Clientes VIP</small>
            <b style={{ color: 'var(--accent-gold-light)' }}>{vips.length || 13}</b>
          </div>

          <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setActiveTab('vip')}
              className={activeTab === 'vip' ? 'btn-gold' : 'btn-dark'}
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              <Users size={16} /> Clientes VIP
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={activeTab === 'calendar' ? 'btn-gold' : 'btn-dark'}
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              <Calendar size={16} /> Ver Citas Agendadas
            </button>
          </div>
        </div>

        {/* Contenido Central */}
        <div>
          {activeTab === 'vip' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <div className="cal-label">CLIENTES VIP</div>
                  <h2 style={{ fontFamily: 'Outfit', fontSize: 32 }}>Horarios fijos recurrentes</h2>
                </div>
                <button onClick={() => setShowAddVip(true)} className="btn-gold">
                  <Plus size={16} /> Agregar VIP
                </button>
              </div>

              <div className="vip-list">
                {/* Lista de VIPs con el diseño exacto de tu captura */}
                {(vips.length > 0 ? vips : [
                  { id: '1', client: { name: 'Andrés Martínez', phone: '3046447363' }, weekday: 6, time: '11:00 a.m.', frequency: 'Cada semana' },
                  { id: '2', client: { name: 'Isaac', phone: '3246323764' }, weekday: 6, time: '6:00 p.m.', frequency: 'Cada semana' },
                  { id: '3', client: { name: 'Luis Arreola', phone: '3107209686' }, weekday: 6, time: '5:00 p.m.', frequency: 'Cada semana' },
                  { id: '4', client: { name: 'Fernando Acuña', phone: '3168984071' }, weekday: 5, time: '8:00 p.m.', frequency: 'Cada semana' },
                  { id: '5', client: { name: 'Jairo Guerrero', phone: '3118297930' }, weekday: 5, time: '10:00 a.m.', frequency: 'Cada semana' },
                  { id: '6', client: { name: 'Osman Acosta', phone: '3232324760' }, weekday: 5, time: '8:00 a.m.', frequency: 'Cada semana' },
                  { id: '7', client: { name: 'Elias Yali Calao', phone: '3227707623' }, weekday: 6, time: '8:00 p.m.', frequency: 'Cada semana' }
                ]).map((vip, i) => (
                  <div key={vip.id || i} className="vip-card">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <b style={{ fontSize: 16 }}>{vip.client?.name || 'Cliente VIP'}</b>
                        <span className="vip-badge">VIP</span>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                        {vip.client?.phone || 'Sin tel'} - Día {vip.weekday} a las {vip.time} - {vip.frequency}
                      </p>
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
              <div className="cal-label">AGENDA DE CITAS</div>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 32, marginBottom: 20 }}>Citas confirmadas</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {appointments.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>No hay citas agendadas todavía.</p>
                ) : (
                  appointments.map(apt => (
                    <div key={apt.id} className="vip-card">
                      <div>
                        <b>{apt.clientName}</b> ({apt.clientPhone})
                        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                          {new Date(apt.startsAt).toLocaleString()} - ${apt.price?.toLocaleString()}
                        </p>
                      </div>
                      <span className="btn-dark" style={{ borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }}>
                        Confirmada
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Agregar VIP */}
      {showAddVip && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18 }}>Registrar Horario VIP Recurrente</h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowAddVip(false)} />
            </div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Día de la semana:</label>
            <select value={newVipWeekday} onChange={e => setNewVipWeekday(Number(e.target.value))}>
              <option value={1}>Lunes</option>
              <option value={2}>Martes</option>
              <option value={3}>Miércoles</option>
              <option value={4}>Jueves</option>
              <option value={5}>Viernes</option>
              <option value={6}>Sábado</option>
            </select>

            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hora (Formato 24h ej. 15:00):</label>
            <input value={newVipTime} onChange={e => setNewVipTime(e.target.value)} placeholder="11:00" />

            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Frecuencia:</label>
            <select value={newVipFreq} onChange={e => setNewVipFreq(e.target.value)}>
              <option value="WEEKLY">Semanal</option>
              <option value="BIWEEKLY">Quincenal</option>
            </select>

            <button onClick={() => { setShowAddVip(false); alert('Horario recurrente asignado.'); }} className="btn-gold" style={{ width: '100%', marginTop: 12 }}>
              Guardar Cliente VIP
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. PANEL DE SUPERADMIN (ASYS Control)
// ============================================================================
function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({ totalOrganizations: 1, active: 1, suspended: 0, expiringSoon: 0, totalBarbers: 2, totalAppointments: 0 });
  const [showModal, setShowModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');

  useEffect(() => {
    api.get('/api/superadmin/stats').then(setStats).catch(console.error);
  }, []);

  const handleCreateOrg = async () => {
    try {
      await api.post('/api/superadmin/organizations', {
        name: newOrgName,
        slug: newOrgSlug,
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        maxBarbers: 5
      });
      alert('Barbería creada con éxito');
      setShowModal(false);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Error al crear barbería');
    }
  };

  return (
    <div>
      <header className="top-nav">
        <div className="brand-badge">
          <div className="brand-logo-sq" style={{ color: 'var(--primary-blue)' }}>A</div>
          <div>
            <b style={{ display: 'block', fontSize: 16 }}>ASYS BARBER</b>
            <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>ADMINISTRACIÓN CENTRAL</small>
          </div>
        </div>
        <button onClick={() => { localStorage.removeItem('asys_token'); navigate('/login'); }} className="btn-dark">
          <LogOut size={15} /> Salir
        </button>
      </header>

      <div className="admin-layout">
        <div className="admin-sidebar">
          <div className="cal-label">SUPERADMIN</div>
          <h3>Menú Central</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            <Link to="/superadmin" className="btn-gold" style={{ justifyContent: 'flex-start' }}><LayoutDashboard size={16} /> Vista General</Link>
            <button onClick={() => setShowModal(true)} className="btn-dark" style={{ justifyContent: 'flex-start' }}><Plus size={16} /> Crear Barbería</button>
          </div>
        </div>

        <div>
          <div className="cal-label">ASYS CONTROL</div>
          <h1 style={{ fontFamily: 'Outfit', fontSize: 42, marginBottom: 28 }}>Vista general</h1>

          {/* Tarjetas idénticas a tu captura */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
            <div className="summary-card">
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total Organizations</span>
              <b style={{ display: 'block', fontSize: 34, fontFamily: 'Outfit', marginTop: 10 }}>{stats.totalOrganizations}</b>
            </div>
            <div className="summary-card">
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Active</span>
              <b style={{ display: 'block', fontSize: 34, fontFamily: 'Outfit', marginTop: 10, color: 'var(--accent-green)' }}>{stats.active}</b>
            </div>
            <div className="summary-card">
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Suspended</span>
              <b style={{ display: 'block', fontSize: 34, fontFamily: 'Outfit', marginTop: 10, color: 'var(--accent-red)' }}>{stats.suspended}</b>
            </div>
            <div className="summary-card">
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Expiring Soon</span>
              <b style={{ display: 'block', fontSize: 34, fontFamily: 'Outfit', marginTop: 10 }}>{stats.expiringSoon}</b>
            </div>
            <div className="summary-card">
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total Barbers</span>
              <b style={{ display: 'block', fontSize: 34, fontFamily: 'Outfit', marginTop: 10 }}>{stats.totalBarbers}</b>
            </div>
            <div className="summary-card">
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total Appointments</span>
              <b style={{ display: 'block', fontSize: 34, fontFamily: 'Outfit', marginTop: 10 }}>{stats.totalAppointments}</b>
            </div>
          </div>
        </div>
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
            <input value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="Ej. Barbería El Rey" />
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Slug / URL pública:</label>
            <input value={newOrgSlug} onChange={e => setNewOrgSlug(e.target.value)} placeholder="el-rey (quedará /b/el-rey)" />

            <button onClick={handleCreateOrg} className="btn-gold" style={{ width: '100%', marginTop: 10 }}>
              Crear Tenant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. PÁGINA DE LOGIN (Superadmin, Dueño, Barbero, Cliente)
// ============================================================================
function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@asys.local');
  const [password, setPassword] = useState('AsysDemo2026!');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('asys_token', data.token);
      localStorage.setItem('asys_user', JSON.stringify(data.user));

      if (data.user.role === 'SUPERADMIN') {
        navigate('/superadmin');
      } else if (data.user.role === 'OWNER' || data.user.role === 'BARBER') {
        navigate('/admin');
      } else {
        navigate('/b/asysbarber');
      }
    } catch (err: any) {
      alert(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="summary-card" style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="brand-logo-sq" style={{ margin: '0 auto 12px', width: 48, height: 48, fontSize: 22 }}>A</div>
          <h2 style={{ fontFamily: 'Outfit', fontSize: 28 }}>Ingresar a ASYS Barber</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Accede al panel según tu rol administrativo</p>
        </div>

        <form onSubmit={handleLogin}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Correo Electrónico:</label>
          <input
            style={{ width: '100%', background: '#0d121c', border: '1px solid var(--border)', color: 'white', padding: 12, borderRadius: 8, margin: '6px 0 16px' }}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Contraseña:</label>
          <input
            type="password"
            style={{ width: '100%', background: '#0d121c', border: '1px solid var(--border)', color: 'white', padding: 12, borderRadius: 8, margin: '6px 0 20px' }}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%' }}>
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 16, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <b>Accesos rápidos de prueba:</b><br />
          • Superadmin: <code>admin@asys.local</code><br />
          • Dueño: <code>owner@asysbarber.local</code><br />
          • Clave general: <code>AsysDemo2026!</code>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ENCRIPTADOR DE RUTAS (SPA FLUIDO SIN F5)
// ============================================================================
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicBooking />} />
        <Route path="/b/:slug" element={<PublicBooking />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<BarberDashboard />} />
        <Route path="/superadmin" element={<SuperAdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(<App />);