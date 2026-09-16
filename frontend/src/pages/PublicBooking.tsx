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

  // Sesión del cliente
  const token = localStorage.getItem('asys_token');
  const userStr = localStorage.getItem('asys_user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  // Horarios de la jornada (09:00 a 19:00)
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

  // Generación matemática de los días del mes (próximos 7 días habilitados)
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

  // Al hacer clic en un día se abre el modal arriba
  const handleDaySelect = async (day: any) => {
    if (!day.inRange) return;
    setSelectedDate(day.dateStr);
    setSelectedTime('');
    setLoadingHours(true);
    setShowHoursModal(true);

    try {
      // Consulta real al endpoint de disponibilidad del backend
      const data = await api.get(`/api/public/${slug}/availability?date=${day.dateStr}&barberId=${selectedBarber || ''}`);
      const serverTimes = data.map((item: any) => item.time);
      setFreeHours(serverTimes.length > 0 ? serverTimes : ['09:00', '10:00', '11:00', '14:00', '15:00', '17:00']);
    } catch {
      // Fallback seguro
      setFreeHours(['10:00', '11:00', '14:00', '16:00']);
    } finally {
      setLoadingHours(false);
    }
  };

  const handlePickHour = (hour: string) => {
    setSelectedTime(hour);
    setShowHoursModal(false); // Cierra la ventana flotante automáticamente
  };

  const handleConfirmAppointment = async () => {
    if (!token) {
      alert('Por favor inicia sesión con tu celular para registrar tu turno.');
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
      alert(err.message || 'Error al confirmar cita');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');
    window.location.reload();
  };

  if (loading) {
    return <div style={{ padding: 100, textAlign: 'center', color: '#64748b' }}>Cargando portal de la barbería...</div>;
  }

  if (!org) {
    return <div style={{ padding: 100, textAlign: 'center', color: '#ef4444' }}>Barbería no disponible temporalmente.</div>;
  }

  return (
    <div className="client-page-wrap">
      
      {/* 1. ENCABEZADO SUPERIOR LIMPIO */}
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
            <button onClick={handleLogout} className="btn-dark">
              <LogOut size={14} /> Cerrar sesión
            </button>
          ) : (
            <Link to="/login" className="btn-gold">Iniciar Sesión</Link>
          )}
        </div>
      </header>

      {/* 2. CUERPO PRINCIPAL */}
      <div className="client-content-container">
        
        {/* Selector de Servicios si hay más de uno */}
        {org.services?.length > 1 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
            {org.services.map((svc: any) => (
              <button
                key={svc.id}
                onClick={() => setSelectedService(svc)}
                className={`clean-tab-btn ${selectedService?.id === svc.id ? 'active' : ''}`}
                style={{ background: selectedService?.id === svc.id ? '#1554ff' : '#ffffff', color: selectedService?.id === svc.id ? '#fff' : '#0b1020', border: '1px solid #e2e8f0', borderRadius: 20, padding: '8px 18px' }}
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
              {currentMonthDays.map((d, index) => (
                <div
                  key={index}
                  onClick={() => handleDaySelect(d)}
                  className={`cal-cell ${!d.inRange ? 'cell-disabled' : ''} ${selectedDate === d.dateStr ? 'cell-selected' : ''}`}
                >
                  <div className="cal-cell-num">{d.dayNum}</div>
                  <div className="cal-cell-status">
                    {d.isSunday ? (
                      <span className="cal-cell-status closed">Cerrado</span>
                    ) : !d.inRange ? (
                      <span className="cal-cell-status closed">Inactivo</span>
                    ) : (
                      <span className="cal-cell-status free">Disponible ●</span>
                    )}
                  </div>
                </div>
              ))}
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
          3. VENTANA MODAL FLOTANTE (ARRIBA EN EL CENTRO)
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
              <button onClick={() => setShowHoursModal(false)} className="btn-dark" style={{ padding: '6px 10px' }}>
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
              Entendido
            </button>
          </div>
        </div>
      )}

    </div>
  );
}