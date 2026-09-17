import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { X, CheckCircle2, LogOut, Crown, AlertCircle, RefreshCw, Sparkles, Calendar as CalIcon } from 'lucide-react';
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

  // Mapa de estado real idéntico al barbero: { "2026-09-21": { status: 'red' | 'yellow' | 'green' | 'closed', statusText: 'Lleno ●', isFull: true, isClosed: false } }
  const [dayStatusMap, setDayStatusMap] = useState<{
    [dateStr: string]: { status: string; statusText: string; isFull: boolean; isClosed: boolean; freeCount: number };
  }>({});

  // Citas futuras del cliente
  const [myUpcomingAppointments, setMyUpcomingAppointments] = useState<any[]>([]);

  // Modo reprogramación VIP
  const [isReschedulingVip, setIsReschedulingVip] = useState(false);
  const [myVipData, setMyVipData] = useState<any>(null);

  // Modal de alertas ASYS
  const [alertModal, setAlertModal] = useState<{ open: boolean; title: string; message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const token = localStorage.getItem('asys_token');
  const userStr = localStorage.getItem('asys_user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  const masterDayHours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
  const weekdayNames = ['Domingos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados'];

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setAlertModal({ open: true, title, message, type });
  };

  const loadOrgData = useCallback(() => {
    api.get(`/api/public/${slug}`)
      .then(data => {
        setOrg(data);
        if (data.services?.length && !selectedService) setSelectedService(data.services[0]);
        if (data.barbers?.length && !selectedBarber) setSelectedBarber(data.barbers[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    if (token) {
      api.get('/api/vip/my-schedule')
        .then(vip => setMyVipData(vip))
        .catch(() => setMyVipData(null));

      api.get('/api/appointments')
        .then(apts => {
          const now = new Date();
          const futures = apts.filter((a: any) => new Date(a.startsAt) >= now && a.status === 'CONFIRMED');
          setMyUpcomingAppointments(futures);
        })
        .catch(() => setMyUpcomingAppointments([]));
    }
  }, [slug, token]);

  useEffect(() => {
    loadOrgData();
  }, [loadOrgData]);

  // CALENDARIO DOMINGO A SÁBADO
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

    return {
      dayNum: i + 1,
      dateStr,
      inRange
    };
  });

  // CONSULTA Y CÁLCULO DE DISPONIBILIDAD IDÉNTICO AL PANEL DEL BARBERO
  const refreshAvailability = useCallback(async () => {
    if (!org) return;
    const activeDays = currentMonthDays.filter(d => d.inRange);
    const newStatusMap: {
      [key: string]: { status: string; statusText: string; isFull: boolean; isClosed: boolean; freeCount: number };
    } = {};

    await Promise.all(
      activeDays.map(async (d) => {
        try {
          const res = await api.get(`/api/public/${slug}/availability?date=${d.dateStr}`);
          
          if (res && typeof res === 'object' && !Array.isArray(res)) {
            const slots = res.slots || [];
            const isClosed = !!res.isClosed;
            const freeCount = typeof res.freeSlotsCount === 'number' ? res.freeSlotsCount : slots.length;
            const status = res.status || (isClosed ? 'closed' : freeCount === 0 ? 'full' : 'green');
            const statusText = res.statusText || (isClosed ? 'Cerrado' : freeCount === 0 ? 'Lleno ●' : `${freeCount} libres ●`);

            newStatusMap[d.dateStr] = {
              status,
              statusText,
              isFull: status === 'full' || freeCount === 0,
              isClosed,
              freeCount
            };
          } else {
            const slots = Array.isArray(res) ? res : [];
            const freeCount = slots.length;
            const isFull = freeCount === 0;
            newStatusMap[d.dateStr] = {
              status: isFull ? 'full' : 'green',
              statusText: isFull ? 'Lleno ●' : `${freeCount} libres ●`,
              isFull,
              isClosed: false,
              freeCount
            };
          }
        } catch {
          newStatusMap[d.dateStr] = {
            status: 'green',
            statusText: 'Disponible ●',
            isFull: false,
            isClosed: false,
            freeCount: 10
          };
        }
      })
    );

    setDayStatusMap(newStatusMap);
  }, [org, slug]);

  useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability]);

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

  const handleDaySelect = async (day: any) => {
    if (!day.inRange) return;

    const dayInfo = dayStatusMap[day.dateStr];
    if (dayInfo?.isClosed) {
      showAlert('Día Cerrado', 'Este día la barbería se encuentra cerrada.', 'info');
      return;
    }
    if (dayInfo?.isFull) {
      showAlert('Día Completo', 'No quedan cupos disponibles para esta fecha. Por favor selecciona otro día.', 'info');
      return;
    }

    setSelectedDate(day.dateStr);
    setSelectedTime('');
    setLoadingHours(true);
    setShowHoursModal(true);

    try {
      const res = await api.get(`/api/public/${slug}/availability?date=${day.dateStr}&barberId=${selectedBarber || ''}`);
      const rawSlots = res?.slots || (Array.isArray(res) ? res : (res?.data || []));

      if (res?.isClosed || rawSlots.length === 0) {
        setFreeHours([]);
      } else {
        const parsed = rawSlots.map((item: any) => normalizeHour(item.time));
        setFreeHours(parsed);
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

  const handleConfirmAction = async () => {
    if (!token) {
      showAlert('Acceso Requerido', 'Por favor inicia sesión para registrar tu turno.', 'info');
      navigate('/login');
      return;
    }

    if (isReschedulingVip) {
      try {
        const origDate = new Date();
        origDate.setDate(origDate.getDate() + ((myVipData.weekday + 7 - origDate.getDay()) % 7));
        const originalDateStr = origDate.toISOString().split('T')[0];

        await api.post('/api/vip/reschedule-week', {
          vipId: myVipData.id,
          originalDateStr,
          newDateStr: selectedDate,
          newTime: selectedTime
        });

        setIsReschedulingVip(false);
        showAlert(
          '¡Turno VIP Modificado!',
          `Tu turno habitual del ${weekdayNames[myVipData.weekday]} ha sido liberado para esta semana. Tu nuevo turno es el ${selectedDate} a las ${selectedTime}.`,
          'success'
        );
        refreshAvailability();
        loadOrgData();
      } catch (err: any) {
        showAlert('Error al reprogramar', err.message || 'No se pudo mover el turno VIP', 'error');
      }
    } else {
      try {
        const startsAt = new Date(`${selectedDate}T${selectedTime}:00-05:00`);
        await api.post('/api/appointments', {
          serviceId: selectedService.id,
          barberId: selectedBarber || undefined,
          startsAt
        });
        showAlert('¡Cita Confirmada!', `Tu turno quedó reservado para el ${selectedDate} a las ${selectedTime}.`, 'success');
        refreshAvailability();
        loadOrgData();
      } catch (err: any) {
        showAlert('No se pudo agendar', err.message || 'Error al confirmar la cita', 'error');
      }
    }
  };

  const handleCancelMyAppointment = async (id: string) => {
    try {
      await api.patch(`/api/appointments/${id}/cancel`, {});
      showAlert('Cita Cancelada', 'Tu cita ha sido cancelada exitosamente.', 'success');
      refreshAvailability();
      loadOrgData();
    } catch (err: any) {
      showAlert('Error', err.message || 'No se pudo cancelar', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');
    api.post('/api/auth/logout', {}).catch(() => {});
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

      {/* 2. CUERPO PRINCIPAL */}
      <div className="client-content-container">
        
        {/* BANNER VIP */}
        {myVipData && !isReschedulingVip && (
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
              onClick={() => {
                setIsReschedulingVip(true);
                setSelectedDate('');
                setSelectedTime('');
              }}
              className="btn-vip-reschedule"
            >
              <RefreshCw size={15} /> Cambiar Turno Esta Semana
            </button>
          </div>
        )}

        {/* PRÓXIMAS CITAS */}
        {myUpcomingAppointments.length > 0 && (
          <div className="upcoming-appointments-box">
            <b style={{ color: '#1e3a8a', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalIcon size={18} color="#1554ff" /> Tus Próximas Citas Agendadas
            </b>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {myUpcomingAppointments.map(apt => (
                <div key={apt.id} className="upcoming-apt-card">
                  <div>
                    <b style={{ fontSize: 14, color: '#0b1020' }}>
                      {new Date(apt.startsAt).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </b>
                    <span style={{ display: 'block', fontSize: 13, color: '#64748b', marginTop: 2 }}>
                      Hora: {new Date(apt.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {apt.service?.name} (${Number(apt.price).toLocaleString('es-CO')}) · Barbero: {apt.barber?.displayName || 'Asignado'}
                    </span>
                  </div>
                  <button onClick={() => handleCancelMyAppointment(apt.id)} className="btn-action-sm btn-cancel">
                    Cancelar Cita
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODO REPROGRAMACIÓN VIP */}
        {isReschedulingVip && (
          <div style={{ background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: 16, padding: '16px 22px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <RefreshCw size={24} color="#1554ff" className="animate-spin" />
              <div>
                <b style={{ color: '#1e3a8a', fontSize: 15, display: 'block' }}>Modo Reprogramación VIP Activo</b>
                <span style={{ color: '#1d4ed8', fontSize: 13 }}>
                  Selecciona en el calendario un día y hora disponible para mover tu turno fijo de esta semana. Tu hora habitual se liberará de inmediato.
                </span>
              </div>
            </div>
            <button onClick={() => setIsReschedulingVip(false)} className="btn-logout-modern">
              Cancelar
            </button>
          </div>
        )}

        {/* SELECTOR DE SERVICIOS */}
        {org.services?.length > 0 && (
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
                <span className="cal-eyebrow">{isReschedulingVip ? 'REPROGRAMAR TURNO VIP' : 'AGENDA ONLINE'}</span>
                <h2 className="cal-month-title">
                  {today.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                </h2>
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

                // Fuera del rango de 7 días: inactivo
                if (!d.inRange) {
                  return (
                    <div key={index} className="cal-cell cell-disabled">
                      <div className="cal-cell-num">{d.dayNum}</div>
                      <div className="cal-cell-status">
                        <span style={{ color: '#94a3b8' }}>Inactivo</span>
                      </div>
                    </div>
                  );
                }

                // Días activos: sincronizados con el semáforo del barbero
                const statusInfo = dayStatusMap[d.dateStr];
                const status = statusInfo?.status || 'green';
                const statusText = statusInfo?.statusText || 'Disponible ●';

                let badgeClass = 'status-green';
                if (status === 'closed' || status === 'red' || status === 'full') {
                  badgeClass = 'status-red';
                } else if (status === 'yellow') {
                  badgeClass = 'status-yellow';
                }

                return (
                  <div
                    key={index}
                    onClick={() => handleDaySelect(d)}
                    className={`cal-cell ${badgeClass} ${isSelected ? 'cell-selected' : ''}`}
                  >
                    <div className="cal-cell-num">{d.dayNum}</div>
                    <div className="cal-cell-status">
                      <span>{statusText}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumen lateral */}
          <div className="client-sidebar">
            <div className="client-summary-card">
              <h3 style={{ fontSize: 18, fontFamily: 'Sora', marginBottom: 16 }}>
                {isReschedulingVip ? 'Confirmar Reprogramación VIP' : 'Resumen de tu Turno'}
              </h3>

              <div className="client-summary-row">
                <span>Servicio</span>
                <b>{selectedService?.name || 'Corte'}</b>
              </div>

              <div className="client-summary-row">
                <span>Fecha Nueva</span>
                <b>{selectedDate || 'Elige en el calendario'}</b>
              </div>

              <div className="client-summary-row">
                <span>Hora Nueva</span>
                <b>{selectedTime || 'Sin seleccionar'}</b>
              </div>

              <div className="client-summary-row">
                <span>Total a pagar</span>
                <span className="client-summary-total">
                  {isReschedulingVip ? '$0 (Turno VIP)' : `$${selectedService ? Number(selectedService.price).toLocaleString('es-CO') : '25.000'}`}
                </span>
              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  onClick={handleConfirmAction}
                  disabled={!selectedDate || !selectedTime}
                  className="btn-clean-submit"
                  style={isReschedulingVip ? { background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#0b1020' } : {}}
                >
                  {isReschedulingVip ? 'Confirmar Cambio de Turno VIP →' : 'Confirmar cita →'}
                </button>
              </div>
            </div>

            <div className="client-wa-card">
              <h4>📱 Recordatorios por WhatsApp</h4>
              <p>El sistema te notificará en tiempo real sobre confirmaciones o reprogramaciones de turno.</p>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL DE HORARIOS FLOTANTE */}
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
              <div style={{ padding: 40, textAlign: 'center', color: '#ef4444', fontWeight: 800 }}>
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

      {/* MODAL DE ALERTAS ASYS */}
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