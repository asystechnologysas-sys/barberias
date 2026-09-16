import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { X, CheckCircle2, LogOut, Clock, Calendar as CalIcon, Scissors } from 'lucide-react';
import { api } from '../api';

export default function PublicBooking() {
  const { slug = 'asysbarber' } = useParams();
  const navigate = useNavigate();
  
  // Datos de la barbería
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedBarber, setSelectedBarber] = useState<string>('');
  
  // Fechas y Horas
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  
  // Modal flotante de horas
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [freeHours, setFreeHours] = useState<string[]>([]);
  const [loadingHours, setLoadingHours] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  // Mapa de disponibilidad para colorear cada día del almanaque
  const [dayStatsMap, setDayStatsMap] = useState<{ [dateStr: string]: { freeCount: number; total: number } }>({});

  // Sesión del cliente
  const token = localStorage.getItem('asys_token');
  const userStr = localStorage.getItem('asys_user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  // Horarios de la jornada estándar (10 turnos posibles al día)
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

  // Generar próximos 7 días habilitados
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

  // Normalizador de horas (convierte "2026-09-17T09:00:00.000Z" o "09:00" a "09:00")
  const normalizeHour = (rawTime: string) => {
    if (!rawTime) return '';
    if (rawTime.includes('T')) {
      const d = new Date(rawTime);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
    return rawTime.slice(0, 5);
  };

  // Al hacer clic en un día se abre el modal flotante en el centro
  const handleDaySelect = async (day: any) => {
    if (!day.inRange) return;
    setSelectedDate(day.dateStr);
    setSelectedTime('');
    setLoadingHours(true);
    setShowHoursModal(true);

    try {
      // Petición real al backend
      const data = await api.get(`/api/public/${slug}/availability?date=${day.dateStr}&barberId=${selectedBarber || ''}`);
      
      if (Array.isArray(data) && data.length > 0) {
        const parsed = data.map((item: any) => normalizeHour(item.time));
        setFreeHours(parsed);
      } else {
        // Si el barbero aún no ha bloqueado horas, toda la jornada está libre
        setFreeHours(masterDayHours);
      }
    } catch {
      // Fallback: todas las horas libres por defecto
      setFreeHours(masterDayHours);
    } finally {
      setLoadingHours(false);
    }
  };

  const handlePickHour = (hour: string) => {
    setSelectedTime(hour);
    setShowHoursModal(false); // Cierra la ventana emergente automáticamente
  };

  const handleConfirmAppointment = async () => {
    if (!token) {
      alert('Debes iniciar sesión con tu cuenta para confirmar tu cita.');
      navigate('/login');
      return;
    }

    try {
      const startsAt = new Date(`${selectedDate}T${selectedTime}:00`);
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

  // Función de cierre de sesión con redirección inmediata al login
  const handleLogout = () => {
    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');
    navigate('/login'); // <-- Redirige de inmediato a la pantalla de login
  };

  // Cálculo de clase de color del semáforo para cada celda
  const getDayStatusClass = (day: any) => {
    if (!day.inRange) return 'cell-disabled';
    
    // Si hay datos en el mapa de ocupación se calculan, si no, como el barbero no ha hecho nada está 100% libre (>80% = verde)
    const stats = dayStatsMap[day.dateStr];
    if (!stats) return 'status-green';

    const freePercentage = stats.freeCount / stats.total;
    if (stats.freeCount === 0) return 'status-red';
    if (freePercentage <= 0.5) return 'status-yellow';
    return 'status-green';
  };

  const getDayStatusLabel = (day: any) => {
    if (day.isSunday) return <span className="cal-cell-status closed">Cerrado</span>;
    if (!day.inRange) return <span className="cal-cell-status closed">Inactivo</span>;

    const stats = dayStatsMap[day.dateStr];
    if (stats && stats.freeCount === 0) {
      return <span className="cal-cell-status full">Lleno ●</span>;
    }
    return <span className="cal-cell-status free">Disponible ●</span>;
  };

  if (loading) {
    return <div style={{ padding: 100, textAlign: 'center', color: '#64748b' }}>Cargando barbería...</div>;
  }

  if (!org) {
    return <div style={{ padding: 100, textAlign: 'center', color: '#ef4444' }}>Barbería no disponible temporalmente.</div>;
  }

  return (
    <div className="client-page-wrap">
      
      {/* 1. ENCABEZADO CON BOTÓN DE CERRAR SESIÓN REDISEÑADO */}
      <header className="client-top-bar">
        <div className="client-brand-area">
          <div className="barber-logo-placeholder">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} />
            ) : (
              org.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="client-welcome-greeting">
            <b>{org.name}</b>
            <span>
              {currentUser ? `👋 Bienvenido, ${currentUser.name}` : 'Agenda tu cita en segundos'}
            </span>
          </div>
        </div>

        <div>
          {token ? (
            <button onClick={handleLogout} className="btn-logout-modern" title="Cerrar sesión y volver al login">
              <LogOut size={15} /> Cerrar sesión
            </button>
          ) : (
            <Link to="/login" className="btn-clean-submit" style={{ padding: '8px 20px', textDecoration: 'none', display: 'inline-block' }}>
              Iniciar Sesión
            </Link>
          )}
        </div>
      </header>

      {/* 2. CUERPO PRINCIPAL */}
      <div className="client-content-container">
        
        {/* Selector de Servicios */}
        {org.services?.length > 1 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
            {org.services.map((svc: any) => (
              <button
                key={svc.id}
                onClick={() => setSelectedService(svc)}
                className={`clean-tab-btn ${selectedService?.id === svc.id ? 'active' : ''}`}
                style={{
                  background: selectedService?.id === svc.id ? '#1554ff' : '#ffffff',
                  color: selectedService?.id === svc.id ? '#fff' : '#0b1020',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 30,
                  padding: '10px 22px',
                  fontWeight: 700
                }}
              >
                {svc.name} · ${Number(svc.price).toLocaleString('es-CO')}
              </button>
            ))}
          </div>
        )}

        <div className="client-grid">
          
          {/* Lado Izquierdo: Almanaque / Calendario */}
          <div className="client-calendar-card">
            <div className="cal-header-bar">
              <div>
                <span className="cal-eyebrow">AGENDA ONLINE</span>
                <h2 className="cal-month-title">Septiembre 2026</h2>
              </div>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                Próximos 7 días hábiles
              </span>
            </div>

            <div className="cal-week-labels">
              <span>DOM</span><span>LUN</span><span>MAR</span><span>MIE</span><span>JUE</span><span>VIE</span><span>SAB</span>
            </div>

            <div className="cal-days-grid">
              {currentMonthDays.map((d, index) => {
                const statusClass = getDayStatusClass(d);
                return (
                  <div
                    key={index}
                    onClick={() => handleDaySelect(d)}
                    className={`cal-cell ${statusClass} ${selectedDate === d.dateStr ? 'cell-selected' : ''}`}
                  >
                    <div className="cal-cell-num">{d.dayNum}</div>
                    <div>{getDayStatusLabel(d)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lado Derecho: Resumen Lateral Fijo */}
          <div className="client-sidebar">
            <div className="client-summary-card">
              <h3 style={{ fontSize: 18, fontFamily: 'Sora', marginBottom: 16 }}>Resumen de tu Turno</h3>

              <div className="client-summary-row">
                <span>Servicio</span>
                <b>{selectedService?.name || 'Corte'}</b>
              </div>

              <div className="client-summary-row">
                <span>Fecha</span>
                <b>{selectedDate || 'Selecciona en el calendario'}</b>
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

              <div style={{ marginTop: 24 }}>
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

      {/* =========================================================
          3. VENTANA MODAL FLOTANTE ARRIBA DE TODO
          ========================================================= */}
      {showHoursModal && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="cal-eyebrow">HORARIOS DISPONIBLES</span>
                <h3 style={{ fontFamily: 'Sora', fontSize: 22, color: '#0b1020', marginTop: 4 }}>
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                  Selecciona una hora disponible para tu cita.
                </p>
              </div>
              <button onClick={() => setShowHoursModal(false)} className="btn-logout-modern" style={{ padding: '6px 10px' }}>
                <X size={18} />
              </button>
            </div>

            {loadingHours ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Consultando turnos libres...</div>
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

      {/* MODAL DE CITA CONFIRMADA CON ÉXITO */}
      {confirmSuccess && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ textAlign: 'center', maxWidth: 440 }}>
            <CheckCircle2 size={54} color="#10b981" style={{ margin: '0 auto 14px' }} />
            <h3 style={{ fontSize: 22, fontFamily: 'Sora', marginBottom: 6 }}>¡Tu cita ha sido confirmada!</h3>
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
              Te esperamos el <b>{selectedDate}</b> a las <b>{selectedTime}</b> en <b>{org.name}</b>.
            </p>
            <button
              onClick={() => { setConfirmSuccess(false); window.location.reload(); }}
              className="btn-clean-submit"
              style={{ marginTop: 20 }}
            >
              Aceptar
            </button>
          </div>
        </div>