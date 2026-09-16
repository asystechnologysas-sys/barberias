import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { X, CheckCircle2, LogOut, Crown } from 'lucide-react';
import { api } from '../api';

export default function PublicBooking() {
  const { slug = 'asysbarber' } = useParams();
  const navigate = useNavigate();
  
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<string>('');
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [freeHours, setFreeHours] = useState<string[]>([]);
  const [loadingHours, setLoadingHours] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  // Sesión y Datos Reales del Cliente
  const token = localStorage.getItem('asys_token');
  const userStr = localStorage.getItem('asys_user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  const masterDayHours = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

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

  // Días habilitados (7 días hábiles)
  const today = new Date();
  const currentMonthDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), i + 1);
    const diffDays = Math.floor((d.getTime() - new Date(today.toDateString()).getTime()) / (1000 * 60 * 60 * 24));
    const inRange = diffDays >= 0 && diffDays <= 7;
    const isSunday = d.getDay() === 0;

    return {
      dayNum: i + 1,
      dateStr: d.toISOString().split('T')[0],
      inRange: inRange && !isSunday,
      isSunday
    };
  });

  const handleDaySelect = async (day: any) => {
    if (!day.inRange) return;
    setSelectedDate(day.dateStr);
    setSelectedTime('');
    setLoadingHours(true);
    setShowHoursModal(true);

    try {
      const data = await api.get(`/api/public/${slug}/availability?date=${day.dateStr}`);
      const serverTimes = data.map((item: any) => item.time);
      setFreeHours(serverTimes);
    } catch {
      setFreeHours(masterDayHours);
    } finally {
      setLoadingHours(false);
    }
  };

  const handlePickHour = (hour: string) => {
    setSelectedTime(hour);
    setShowHoursModal(false);
  };

  const handleConfirmAppointment = async () => {
    if (!token) {
      alert('Debes iniciar sesión con tu cuenta para confirmar tu cita.');
      navigate('/login');
      return;
    }

    try {
      const startsAt = new Date(`${selectedDate}T${selectedTime}:00-05:00`);
      await api.post('/api/appointments', {
        serviceId: selectedService.id,
        barberId: selectedBarber || undefined,
        startsAt
      });
      setConfirmSuccess(true);
    } catch (err: any) {
      alert(err.message || 'Error al confirmar la cita');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');
    navigate('/login');
  };

  if (loading) return <div style={{ padding: 100, textAlign: 'center', color: '#64748b' }}>Cargando barbería...</div>;
  if (!org) return <div style={{ padding: 100, textAlign: 'center', color: '#ef4444' }}>Barbería no disponible.</div>;

  return (
    <div className="client-page-wrap">
      
      {/* 1. ENCABEZADO SUPERIOR CON SALUDO REAL Y BADGE VIP */}
      <header className="client-top-bar">
        <div className="client-brand-area">
          <div className="barber-logo-placeholder">
            {org.logoUrl ? <img src={org.logoUrl} alt={org.name} /> : org.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="client-welcome-greeting">
            <b>{org.name}</b>
            <span>
              {currentUser ? (
                currentUser.isVip ? (
                  <span style={{ color: '#d97706', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Crown size={14} color="#f59e0b" /> Bienvenido, {currentUser.name} (Cliente VIP)
                  </span>
                ) : (
                  `👋 Bienvenido, ${currentUser.name}`
                )
              ) : (
                'Agenda tu cita en segundos'
              )}
            </span>
          </div>
        </div>

        <div>
          {token ? (
            <button onClick={handleLogout} className="btn-logout-modern" title="Cerrar sesión">
              <LogOut size={15} /> Cerrar sesión
            </button>
          ) : (
            <Link to="/login" className="btn-clean-submit" style={{ padding: '8px 18px', textDecoration: 'none', display: 'inline-block', fontSize: 13 }}>
              Iniciar Sesión
            </Link>
          )}
        </div>
      </header>

      {/* 2. CUERPO PRINCIPAL */}
      <div className="client-content-container">
        
        {/* Selector de Servicios */}
        {org.services?.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 6 }}>
            {org.services.map((svc: any) => (
              <button
                key={svc.id}
                onClick={() => setSelectedService(svc)}
                className="clean-tab-btn"
                style={{
                  background: selectedService?.id === svc.id ? '#1554ff' : '#ffffff',
                  color: selectedService?.id === svc.id ? '#ffffff' : '#0b1020',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 30,
                  padding: '8px 18px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  fontSize: 13
                }}
              >
                {svc.name} · ${Number(svc.price).toLocaleString('es-CO')}
              </button>
            ))}
          </div>
        )}

        <div className="client-grid">
          
          {/* Calendario */}
          <div className="client-calendar-card">
            <div className="cal-header-bar">
              <div>
                <span className="cal-eyebrow">AGENDA ONLINE</span>
                <h2 className="cal-month-title">Septiembre 2026</h2>
              </div>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Próximos 7 días hábiles</span>
            </div>

            <div className="cal-week-labels">
              <span>DOM</span><span>LUN</span><span>MAR</span><span>MIE</span><span>JUE</span><span>VIE</span><span>SAB</span>
            </div>

            <div className="cal-days-grid">
              {currentMonthDays.map((d, index) => (
                <div
                  key={index}
                  onClick={() => handleDaySelect(d)}
                  className={`cal-cell ${!d.inRange ? 'cell-disabled' : 'status-green'} ${selectedDate === d.dateStr ? 'cell-selected' : ''}`}
                >
                  <div className="cal-cell-num">{d.dayNum}</div>
                  <div className="cal-cell-status">
                    {d.isSunday ? (
                      <span style={{ color: '#94a3b8' }}>Cerrado</span>
                    ) : !d.inRange ? (
                      <span style={{ color: '#94a3b8' }}>Inactivo</span>
                    ) : (
                      <span>● Libre</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumen lateral */}
          <div className="client-sidebar">
            <div className="client-summary-card">
              <h3 style={{ fontSize: 18, fontFamily: 'Sora', marginBottom: 16 }}>Resumen de tu Turno</h3>

              <div className="client-summary-row">
                <span>Servicio</span>
                <b>{selectedService?.name || 'Corte'}</b>
              </div>

              <div className="client-summary-row">
                <span>Fecha</span>
                <b>{selectedDate || 'Elige en el calendario'}</b>
              </div>

              <div className="client-summary-row">
                <span>Hora</span>
                <b>{selectedTime || 'Sin seleccionar'}</b>
              </div>

              <div className="client-summary-row">
                <span>Total a pagar</span>
                <span className="client-summary-total">
                  ${selectedService ? Number(selectedService.price).toLocaleString('es-CO') : '25.000'}
                </span>
              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  onClick={handleConfirmAppointment}
                  disabled={!selectedDate || !selectedTime}
                  className="btn-clean-submit"
                >
                  Confirmar cita →
                </button>
              </div>
            </div>

            <div className="client-wa-card">
              <h4>📱 Recordatorios por WhatsApp</h4>
              <p>Al confirmar tu cita, el sistema te enviará una notificación con la fecha, hora y servicio agendado sin costo adicional.</p>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL DE HORARIOS FLOTANTE ARRIBA */}
      {showHoursModal && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="cal-eyebrow">HORARIOS DISPONIBLES</span>
                <h3 style={{ fontFamily: 'Sora', fontSize: 20, color: '#0b1020', marginTop: 2 }}>
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <p style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                  Selecciona una hora disponible para tu cita.
                </p>
              </div>
              <button onClick={() => setShowHoursModal(false)} className="btn-logout-modern" style={{ padding: '6px 10px' }}>
                <X size={18} />
              </button>
            </div>

            {loadingHours ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>Consultando turnos...</div>
            ) : (
              <div className="modal-hours-grid">
                {masterDayHours.map((hour) => {
                  const isAvailable = freeHours.includes(hour);
                  return (
                    <button
                      key={hour}
                      disabled={!isAvailable}
                      onClick={() => handlePickHour(hour)}
                      className="btn-hour-slot"
                    >
                      {hour} {isAvailable ? '' : '✕'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN ÉXITO */}
      {confirmSuccess && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ textAlign: 'center', maxWidth: 420 }}>
            <CheckCircle2 size={50} color="#10b981" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 20, fontFamily: 'Sora', marginBottom: 6 }}>¡Cita Confirmada!</h3>
            <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
              Tu turno quedó reservado para el <b>{selectedDate}</b> a las <b>{selectedTime}</b> en <b>{org.name}</b>.
            </p>
            <button
              onClick={() => { setConfirmSuccess(false); window.location.reload(); }}
              className="btn-clean-submit"
              style={{ marginTop: 18 }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}