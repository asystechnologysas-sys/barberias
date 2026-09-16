import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { X, CheckCircle2, LogOut, Crown, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
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

  // Horario VIP dinámico y real
  const [myVipData, setMyVipData] = useState<any>(null);
  const [showVipModal, setShowVipModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('11:00');

  // Ventana de Alerta ASYS (Sustituye alert() del navegador)
  const [alertModal, setAlertModal] = useState<{ open: boolean; title: string; message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const token = localStorage.getItem('asys_token');
  const userStr = localStorage.getItem('asys_user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  const masterDayHours = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
  const weekdayNames = ['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'];

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setAlertModal({ open: true, title, message, type });
  };

  useEffect(() => {
    // 1. Cargar datos de la barbería
    api.get(`/api/public/${slug}`)
      .then(data => {
        setOrg(data);
        if (data.services?.length) setSelectedService(data.services[0]);
        if (data.barbers?.length) setSelectedBarber(data.barbers[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // 2. Si está logueado, consultar su horario VIP real en la BD
    if (token) {
      api.get('/api/vip/my-schedule')
        .then(vip => setMyVipData(vip))
        .catch(() => setMyVipData(null));
    }
  }, [slug, token]);

  // CALENDARIO DOMINGO A SÁBADO CON DÍAS REALMENTE CERRADOS
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const emptyPaddingDays = Array.from({ length: firstDayIndex }, (_, i) => i);

  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    const dateStr = d.toISOString().split('T')[0];
    const diffDays = Math.floor((d.getTime() - new Date(today.toDateString()).getTime()) / (1000 * 60 * 60 * 24));
    const inRange = diffDays >= 0 && diffDays <= 7;
    const isSunday = d.getDay() === 0;

    // Verificar si el día está bloqueado por el barbero en la base de datos
    const isDayClosedInDb = org?.blockedSlots?.some((b: any) => {
      const bStart = new Date(b.startsAt);
      const bEnd = new Date(b.endsAt);
      return bStart <= new Date(`${dateStr}T00:00:00-05:00`) && bEnd >= new Date(`${dateStr}T23:59:59-05:00`);
    });

    return {
      dayNum: i + 1,
      dateStr,
      inRange: inRange && !isSunday && !isDayClosedInDb,
      isSunday,
      isDayClosedInDb
    };
  });

  const handleDaySelect = async (day: any) => {
    if (!day.inRange) return;
    setSelectedDate(day.dateStr);
    setSelectedTime('');
    setLoadingHours(true);
    setShowHoursModal(true);

    try {
      const res = await api.get(`/api/public/${slug}/availability?date=${day.dateStr}`);
      if (res.isClosed) {
        setFreeHours([]);
      } else {
        const serverTimes = res.data?.map((item: any) => item.time) || res.map((item: any) => item.time) || [];
        setFreeHours(serverTimes);
      }
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
      showAlert('Acceso Requerido', 'Por favor inicia sesión con tu celular para registrar tu turno.', 'info');
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
      showAlert('¡Cita Confirmada!', `Tu turno quedó reservado para el ${selectedDate} a las ${selectedTime}.`, 'success');
    } catch (err: any) {
      showAlert('No se pudo agendar', err.message || 'Error al confirmar la cita', 'error');
    }
  };

  // REPROGRAMAR TURNO VIP SOLO POR ESTA SEMANA
  const handleConfirmVipReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      return showAlert('Campos requeridos', 'Selecciona el nuevo día y la hora para mover tu turno.', 'error');
    }

    try {
      // Calcular fecha original del sábado/día VIP de esta semana
      const origDate = new Date();
      origDate.setDate(origDate.getDate() + ((myVipData.weekday + 7 - origDate.getDay()) % 7));
      const originalDateStr = origDate.toISOString().split('T')[0];

      await api.post('/api/vip/reschedule-week', {
        vipId: myVipData.id,
        originalDateStr,
        newDateStr: rescheduleDate,
        newTime: rescheduleTime
      });

      setShowVipModal(false);
      showAlert(
        '¡Turno VIP Reprogramado!',
        `Tu hora habitual del ${weekdayNames[myVipData.weekday]} ha sido liberada para esta semana y tu nuevo turno quedó para el ${rescheduleDate} a las ${rescheduleTime}.`,
        'success'
      );
    } catch (err: any) {
      showAlert('Error al reprogramar', err.message || 'No se pudo mover el turno VIP', 'error');
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
      
      {/* 1. ENCABEZADO */}
      <header className="client-top-bar">
        <div className="client-brand-area">
          <div className="barber-logo-placeholder">
            {org.logoUrl ? <img src={org.logoUrl} alt={org.name} /> : org.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="client-welcome-greeting">
            <b>{org.name}</b>
            <span>
              {currentUser ? (
                myVipData ? (
                  <span style={{ color: '#d97706', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Crown size={15} color="#f59e0b" /> {currentUser.name} (Cliente VIP)
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

      {/* 2. CONTENIDO */}
      <div className="client-content-container">
        
        {/* BANNER VIP DINÁMICO (Muestra la hora real de este VIP) */}
        {myVipData && (
          <div style={{ background: '#fffdf5', border: '1.5px solid #fde68a', borderRadius: 18, padding: '18px 24px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, boxShadow: '0 4px 15px rgba(217, 119, 6, 0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fef3c7', display: 'grid', placeItems: 'center' }}>
                <Crown size={24} color="#d97706" />
              </div>
              <div>
                <b style={{ color: '#92400e', fontSize: 16, display: 'block' }}>Tu Turno Fijo VIP Semanal está Asegurado</b>
                <span style={{ color: '#b45309', fontSize: 13 }}>
                  Tienes reservado todos los <b>{weekdayNames[myVipData.weekday]} a las {myVipData.time}</b>. Tienes hasta 2 citas adicionales esta semana.
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowVipModal(true)}
              className="btn-vip-reschedule"
            >
              <RefreshCw size={15} /> Cambiar Turno Esta Semana
            </button>
          </div>
        )}

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
          
          {/* Calendario con DOMINGO a SÁBADO */}
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
              {emptyPaddingDays.map((_, i) => (
                <div key={`empty-${i}`} className="cal-cell cell-disabled" style={{ opacity: 0.15 }}></div>
              ))}

              {currentMonthDays.map((d, index) => {
                const isSelected = selectedDate === d.dateStr;
                const isClosed = d.isSunday || d.isDayClosedInDb;

                return (
                  <div
                    key={index}
                    onClick={() => handleDaySelect(d)}
                    className={`cal-cell ${isClosed ? 'status-red' : !d.inRange ? 'cell-disabled' : 'status-green'} ${isSelected ? 'cell-selected' : ''}`}
                  >
                    <div className="cal-cell-num">{d.dayNum}</div>
                    <div className="cal-cell-status">
                      {isClosed ? (
                        <span style={{ color: '#dc2626' }}>Cerrado</span>
                      ) : !d.inRange ? (
                        <span style={{ color: '#94a3b8' }}>Inactivo</span>
                      ) : (
                        <span>● Libre</span>
                      )}
                    </div>
                  </div>
                );
              })}
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

      {/* MODAL FLOTANTE DE HORAS DISPONIBLES */}
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
            ) : freeHours.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>
                Este día se encuentra cerrado o totalmente lleno.
              </div>
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

      {/* MODAL DE REPROGRAMAR TURNO VIP ESTA SEMANA */}
      {showVipModal && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Sora', fontSize: 18, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Crown size={20} color="#d97706" /> Mover Turno VIP Esta Semana
              </h3>
              <button onClick={() => setShowVipModal(false)} className="btn-logout-modern" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
              Al mover tu turno, tu horario habitual del <b>{weekdayNames[myVipData?.weekday]} a las {myVipData?.time}</b> se liberará solo para esta semana, y quedarás agendado en la nueva fecha que elijas.
            </p>

            <label className="input-label">Selecciona la Nueva Fecha</label>
            <input
              type="date"
              value={rescheduleDate}
              onChange={e => setRescheduleDate(e.target.value)}
              className="clean-input"
              style={{ marginBottom: 14 }}
            />

            <label className="input-label">Selecciona la Nueva Hora</label>
            <select
              value={rescheduleTime}
              onChange={e => setRescheduleTime(e.target.value)}
              className="clean-input"
              style={{ marginBottom: 22 }}
            >
              {masterDayHours.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            <button onClick={handleConfirmVipReschedule} className="btn-vip-reschedule" style={{ width: '100%', justifyContent: 'center' }}>
              Confirmar Cambio de Turno VIP
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE ALERTAS FLOTANTES ASYS (Cero popups nativos) */}
      {alertModal && alertModal.open && (
        <div className="modal-hours-overlay">
          <div className="asys-alert-modal">
            <div className={`asys-alert-icon ${alertModal.type}`}>
              {alertModal.type === 'success' && <CheckCircle2 size={32} />}
              {alertModal.type === 'error' && <AlertCircle size={32} />}
              {alertModal.type === 'info' && <Sparkles size={32} />}
            </div>
            <h3 style={{ fontFamily: 'Sora', fontSize: 20, marginBottom: 8, color: '#0b1020' }}>{alertModal.title}</h3>
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5, marginBottom: 22 }}>
              {alertModal.message}
            </p>
            <button
              onClick={() => {
                setAlertModal(null);
                if (alertModal.type === 'success') window.location.reload();
              }}
              className="btn-clean-submit"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}