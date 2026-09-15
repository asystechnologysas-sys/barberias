import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { X, CheckCircle2, LogOut } from 'lucide-react';
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
  
  // Modal de Horas Flotante Arriba
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [availableHours, setAvailableHours] = useState<string[]>([]);
  const [loadingHours, setLoadingHours] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

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

  // Lista base de horas de atención de la barbería
  const baseHours = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

  // Próximos 7 días hábiles
  const today = new Date();
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), i + 1);
    const diff = Math.floor((d.getTime() - new Date(today.toDateString()).getTime()) / (1000 * 60 * 60 * 24));
    const inRange = diff >= 0 && diff <= 7;
    // Si el día es domingo (0) está cerrado
    const isClosed = d.getDay() === 0;
    return {
      dayNum: i + 1,
      dateStr: d.toISOString().split('T')[0],
      inRange: inRange && !isClosed,
      isClosed
    };
  });

  const handleOpenDay = async (day: any) => {
    if (!day.inRange) return;
    setSelectedDate(day.dateStr);
    setSelectedTime('');
    setLoadingHours(true);
    setShowHoursModal(true);

    try {
      const data = await api.get(`/api/public/${slug}/availability?date=${day.dateStr}`);
      const freeSlots = data.map((s: any) => s.time);
      setAvailableHours(freeSlots.length > 0 ? freeSlots : ['10:00', '11:00', '14:00', '16:00', '17:00']);
    } catch {
      setAvailableHours(['10:00', '11:00', '15:00', '16:00']);
    } finally {
      setLoadingHours(false);
    }
  };

  const handleConfirmAppointment = async () => {
    if (!token) {
      alert('Debes identificarte antes de confirmar la cita.');
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
      setBookingSuccess(true);
    } catch (err: any) {
      alert(err.message || 'Error al agendar cita');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');
    window.location.reload();
  };

  if (loading) return <div style={{ padding: 80, textAlign: 'center', color: '#94a3b8' }}>Cargando barbería...</div>;
  if (!org) return <div style={{ padding: 80, textAlign: 'center', color: '#ef4444' }}>Barbería no disponible.</div>;

  return (
    <div>
      {/* Encabezado limpio: solo para clientes */}
      <header className="top-nav">
        <div className="brand-badge">
          <div className="brand-logo-sq">JM</div>
          <div>
            <b style={{ fontSize: 16 }}>{org.name}</b>
            <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12 }}>
              {selectedService ? `${selectedService.name} - $${selectedService.price.toLocaleString('es-CO')}` : 'Corte profesional'}
            </small>
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
              {days.map((d, i) => (
                <div
                  key={i}
                  onClick={() => handleOpenDay(d)}
                  className={`cal-day-cell ${!d.inRange ? 'disabled' : ''} ${selectedDate === d.dateStr ? 'selected' : ''}`}
                >
                  <div className="cal-day-num">{d.dayNum}</div>
                  <div className="cal-day-status">
                    {!d.inRange ? (
                      <span style={{ color: '#475569' }}>Fuera de rango</span>
                    ) : (
                      <span className="cal-day-status free">Disponible ●</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumen lateral */}
          <div className="booking-summary-col">
            <div className="summary-card">
              <div className="summary-row">
                <span>Precio</span>
                <b style={{ color: 'white', fontSize: 20 }}>${selectedService?.price.toLocaleString('es-CO')}</b>
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
                  onClick={handleConfirmAppointment}
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
              <p>Activa alertas gratis para recordatorios 24 h antes y confirmación al reservar. En iPhone o Android, agenda tu corte en segundos.</p>
              <a href="https://wa.me/573117304768" target="_blank" className="btn-dark" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                Activar notificaciones
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* VENTANA FLOTANTE DE HORARIOS (ARRIBA EN EL CENTRO) */}
      {showHoursModal && (
        <div className="modal-overlay">
          <div className="hours-modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="cal-label">HORARIOS DISPONIBLES</div>
                <h2 style={{ fontFamily: 'Outfit', fontSize: 26, marginTop: 4 }}>
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

            {loadingHours ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Consultando disponibilidad...</div>
            ) : (
              <div className="hours-grid">
                {baseHours.map((h) => {
                  const isAvailable = availableHours.includes(h);
                  return (
                    <button
                      key={h}
                      disabled={!isAvailable}
                      onClick={() => { setSelectedTime(h); setShowHoursModal(false); }}
                      className={`hour-btn ${!isAvailable ? 'booked' : ''}`}
                    >
                      {h} {isAvailable ? '' : '✕'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL ÉXITO */}
      {bookingSuccess && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ textAlign: 'center' }}>
            <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 22, marginBottom: 8 }}>¡Cita Agendada con Éxito!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              Tu turno quedó reservado para el {selectedDate} a las {selectedTime}.
            </p>
            <button onClick={() => { setBookingSuccess(false); window.location.reload(); }} className="btn-gold" style={{ marginTop: 20 }}>
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}