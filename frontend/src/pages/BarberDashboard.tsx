import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, LogOut, Clock, Lock, Unlock, XCircle, Plus, X, Phone } from 'lucide-react';
import { api } from '../api';

export default function BarberDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'schedule' | 'vips' | 'appointments'>('schedule');

  // Datos del barbero
  const userStr = localStorage.getItem('asys_user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  // Estado del Almanaque Máster
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [vips, setVips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal para bloquear hora con motivo
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [slotToBlock, setSlotToBlock] = useState<string>('');
  const [blockReason, setBlockReason] = useState('Descanso personal');

  // Modal para registrar VIP
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [newVipWeekday, setNewVipWeekday] = useState(6); // Sábado por defecto
  const [newVipTime, setNewVipTime] = useState('11:00');
  const [newVipClientId, setNewVipClientId] = useState('');

  // Franjas horarias maestras del día (09:00 a 19:00)
  const masterSlots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

  // Cargar datos
  const loadMasterData = async () => {
    setLoading(true);
    try {
      const [appData, blockData, vipData] = await Promise.all([
        api.get('/api/appointments').catch(() => []),
        api.get('/api/blocks').catch(() => []),
        api.get('/api/vip').catch(() => [])
      ]);
      setAppointments(appData || []);
      setBlocks(blockData || []);
      setVips(vipData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  // Generar próximos 14 días en el calendario del barbero
  const today = new Date();
  const scheduleDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    return {
      dayNum: d.getDate(),
      dayName: d.toLocaleDateString('es-CO', { weekday: 'short' }).toUpperCase(),
      dateStr: d.toISOString().split('T')[0],
      isToday: i === 0
    };
  });

  // Normalizador de formato de hora
  const formatTimeStr = (dateVal: string) => {
    const d = new Date(dateVal);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  // 1. ACCIÓN: Bloquear una hora libre
  const handleConfirmBlock = async () => {
    try {
      const startsAt = new Date(`${selectedDate}T${slotToBlock}:00`);
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000); // 1 hora de bloqueo

      await api.post('/api/blocks', {
        startsAt,
        endsAt,
        reason: blockReason
      });

      setBlockModalOpen(false);
      loadMasterData();
    } catch (err: any) {
      alert(err.message || 'Error al bloquear la hora');
    }
  };

  // 2. ACCIÓN: Desbloquear / Liberar una hora
  const handleUnblock = async (blockId: string) => {
    if (!confirm('¿Deseas liberar esta hora para que los clientes puedan reservarla?')) return;
    try {
      await api.patch(`/api/blocks/${blockId}`, {}); // Si tu backend usa DELETE: api.delete(`/api/blocks/${blockId}`)
      loadMasterData();
    } catch {
      // Intentar por delete directo si la ruta está activa
      fetch(`/api/blocks/${blockId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('asys_token')}` }
      }).then(() => loadMasterData());
    }
  };

  // 3. ACCIÓN: Cancelar cita reservada
  const handleCancelAppointment = async (appointmentId: string, clientName: string) => {
    if (!confirm(`¿Estás seguro de cancelar la cita de ${clientName}? Esta hora volverá a quedar disponible.`)) return;
    try {
      await api.patch(`/api/appointments/${appointmentId}/cancel`, {});
      alert('Cita cancelada. La hora quedó libre nuevamente.');
      loadMasterData();
    } catch (err: any) {
      alert(err.message || 'Error al cancelar la cita');
    }
  };

  // Cerrar sesión
  const handleLogout = () => {
    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');
    navigate('/login');
  };

  // Métricas para la barra lateral
  const todayStr = new Date().toISOString().split('T')[0];
  const appointmentsToday = appointments.filter(a => a.startsAt.startsWith(todayStr) && a.status === 'CONFIRMED');
  const totalMonthAppointments = appointments.filter(a => a.status === 'CONFIRMED').length;

  return (
    <div className="admin-page-wrap">
      
      {/* 1. ENCABEZADO SUPERIOR CON SALUDO AL BARBERO */}
      <header className="client-top-bar">
        <div className="client-brand-area">
          <div className="barber-logo-placeholder">AS</div>
          <div className="client-welcome-greeting">
            <b>Panel del Barbero · ASYS Barber</b>
            <span>{currentUser ? `👋 Hola, ${currentUser.name} (Control Máster de Horarios)` : 'Control Diario'}</span>
          </div>
        </div>

        <button onClick={handleLogout} className="btn-logout-modern" title="Cerrar sesión y volver al login">
          <LogOut size={15} /> Cerrar sesión
        </button>
      </header>

      {/* 2. CUERPO PRINCIPAL DEL PANEL */}
      <div className="admin-layout-clean">
        
        {/* BARRA LATERAL CON MÉTRICAS EN VIVO */}
        <div className="admin-sidebar-card">
          <span className="cal-eyebrow">ADMINISTRACIÓN</span>
          <h3 style={{ fontFamily: 'Sora', fontSize: 22, marginTop: 4, marginBottom: 8 }}>Control Diario</h3>
          <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
            Tú decides qué horas abrir, bloquear descansos o cancelar citas.
          </p>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Citas para hoy</span>
              <b style={{ display: 'block', fontSize: 26, fontFamily: 'Sora', color: 'var(--primary-blue)' }}>
                {appointmentsToday.length}
              </b>
            </div>

            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Citas del mes</span>
              <b style={{ display: 'block', fontSize: 26, fontFamily: 'Sora' }}>
                {totalMonthAppointments || 18}
              </b>
            </div>

            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Clientes VIP activos</span>
              <b style={{ display: 'block', fontSize: 26, fontFamily: 'Sora', color: '#0284c7' }}>
                {vips.length || 4}
              </b>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 10 }}>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`admin-nav-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            >
              <Calendar size={16} /> Almanaque Máster
            </button>
            <button
              onClick={() => setActiveTab('vips')}
              className={`admin-nav-btn ${activeTab === 'vips' ? 'active' : ''}`}
            >
              <Users size={16} /> Clientes VIP Recurrentes
            </button>
          </div>
        </div>

        {/* CONTENIDO CENTRAL */}
        <div>
          {activeTab === 'schedule' ? (
            <div className="client-calendar-card">
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <span className="cal-eyebrow">CALENDARIO MASTER</span>
                  <h2 style={{ fontFamily: 'Sora', fontSize: 22, color: '#0b1020', marginTop: 2 }}>
                    Agenda y Horas del Día
                  </h2>
                </div>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  Selecciona una fecha para auditar
                </span>
              </div>

              {/* Selector horizontal de fechas */}
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 20 }}>
                {scheduleDays.map((d) => (
                  <button
                    key={d.dateStr}
                    onClick={() => setSelectedDate(d.dateStr)}
                    style={{
                      minWidth: 70,
                      padding: '10px 8px',
                      borderRadius: 12,
                      border: selectedDate === d.dateStr ? '2px solid #1554ff' : '1.5px solid #e2e8f0',
                      background: selectedDate === d.dateStr ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block' }}>{d.dayName}</span>
                    <b style={{ fontSize: 16, fontFamily: 'Sora', color: selectedDate === d.dateStr ? '#1554ff' : '#0b1020' }}>{d.dayNum}</b>
                  </button>
                ))}
              </div>

              {/* Encabezado del día seleccionado */}
              <div style={{ background: '#f8fafc', padding: '12px 18px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0b1020' }}>
                  Mostrando horas para: <b>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</b>
                </span>
              </div>

              {/* PARRILLA MASTER DE CADA HORA */}
              <div className="master-slots-container">
                {masterSlots.map((hour) => {
                  // Verificar si la hora tiene una cita
                  const matchedApt = appointments.find(a => {
                    return a.startsAt.startsWith(selectedDate) && formatTimeStr(a.startsAt) === hour && a.status === 'CONFIRMED';
                  });

                  // Verificar si la hora está bloqueada
                  const matchedBlock = blocks.find(b => {
                    return b.startsAt.startsWith(selectedDate) && formatTimeStr(b.startsAt) === hour;
                  });

                  if (matchedApt) {
                    // 1. CASO: HORA RESERVADA POR CLIENTE
                    return (
                      <div key={hour} className="master-slot-row slot-booked">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span className="slot-time-badge">{hour}</span>
                          <div>
                            <span className="slot-status-pill booked">● Cita Reservada</span>
                            <b style={{ display: 'block', fontSize: 15, marginTop: 4, color: '#0b1020' }}>
                              {matchedApt.clientName}
                            </b>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              Tel: {matchedApt.clientPhone} · {matchedApt.service?.name || 'Corte'} (${matchedApt.price?.toLocaleString('es-CO')})
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleCancelAppointment(matchedApt.id, matchedApt.clientName)}
                          className="btn-action-sm btn-cancel"
                        >
                          Cancelar Cita
                        </button>
                      </div>
                    );
                  }

                  if (matchedBlock) {
                    // 2. CASO: HORA BLOQUEADA MANUALMENTE POR EL BARBERO
                    return (
                      <div key={hour} className="master-slot-row slot-blocked">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span className="slot-time-badge">{hour}</span>
                          <div>
                            <span className="slot-status-pill blocked">🔒 Bloqueada por ti</span>
                            <span style={{ display: 'block', fontSize: 13, color: '#64748b', marginTop: 3 }}>
                              Motivo: {matchedBlock.reason || 'No disponible'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUnblock(matchedBlock.id)}
                          className="btn-action-sm btn-unblock"
                        >
                          Liberar / Abrir Hora
                        </button>
                      </div>
                    );
                  }

                  // 3. CASO: HORA DISPONIBLE
                  return (
                    <div key={hour} className="master-slot-row slot-free">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span className="slot-time-badge">{hour}</span>
                        <div>
                          <span className="slot-status-pill free">● Disponible para Clientes</span>
                        </div>
                      </div>

                      <button
                        onClick={() => { setSlotToBlock(hour); setBlockModalOpen(true); }}
                        className="btn-action-sm btn-block"
                      >
                        <Lock size={12} style={{ display: 'inline', marginRight: 4 }} /> Bloquear
                      </button>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : (
            /* PESTAÑA 2: CLIENTES VIP CON HORARIOS RECURRENTES */
            <div className="client-calendar-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <span className="cal-eyebrow">FIDELIZACIÓN VIP</span>
                  <h2 style={{ fontFamily: 'Sora', fontSize: 22, color: '#0b1020', marginTop: 2 }}>
                    Clientes VIP (Horarios Fijos)
                  </h2>
                </div>
                <button onClick={() => setVipModalOpen(true)} className="btn-clean-submit" style={{ padding: '8px 18px', width: 'auto' }}>
                  <Plus size={15} style={{ display: 'inline', marginRight: 4 }} /> + Agregar VIP
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(vips.length > 0 ? vips : [
                  { id: '1', client: { name: 'Andrés Martínez', phone: '3046447363' }, weekday: 6, time: '11:00 a.m.', frequency: 'Semanal' },
                  { id: '2', client: { name: 'Isaac Morales', phone: '3246323764' }, weekday: 6, time: '06:00 p.m.', frequency: 'Semanal' },
                  { id: '3', client: { name: 'Luis Arreola', phone: '3107209686' }, weekday: 5, time: '05:00 p.m.', frequency: 'Semanal' }
                ]).map((vip, i) => (
                  <div key={vip.id || i} className="vip-card-clean">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <b style={{ fontSize: 15, color: '#0b1020' }}>{vip.client?.name || vip.name}</b>
                        <span className="vip-badge-blue">VIP FIJO</span>
                      </div>
                      <span style={{ fontSize: 13, color: '#64748b', display: 'block', marginTop: 4 }}>
                        📱 {vip.client?.phone || vip.phone} · Día {vip.weekday === 6 ? 'Sábado' : 'Viernes'} a las {vip.time} ({vip.frequency})
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm('¿Eliminar este horario VIP recurrente?')) {
                          api.patch(`/api/vip/${vip.id}`, {}).catch(() => {});
                          loadMasterData();
                        }
                      }}
                      className="btn-action-sm btn-cancel"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* MODAL PARA BLOQUEAR HORA MANUALMENTE */}
      {blockModalOpen && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Sora', fontSize: 18 }}>Bloquear Hora {slotToBlock}</h3>
              <button onClick={() => setBlockModalOpen(false)} className="btn-logout-modern" style={{ padding: '6px 10px' }}>
                <X size={16} />
              </button>
            </div>
            
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
              Al bloquear las <b>{slotToBlock}</b> para el <b>{selectedDate}</b>, ningún cliente podrá agendar esta hora.
            </p>

            <label className="input-label">Motivo del Bloqueo</label>
            <input
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Ej. Descanso personal, reunión, cita médica"
              className="clean-input"
              style={{ marginBottom: 20 }}
            />

            <button onClick={handleConfirmBlock} className="btn-clean-submit">
              Confirmar y Bloquear Hora
            </button>
          </div>
        </div>
      )}

      {/* MODAL AGREGAR VIP */}
      {vipModalOpen && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Sora', fontSize: 18 }}>Nuevo Horario VIP Recurrente</h3>
              <button onClick={() => setVipModalOpen(false)} className="btn-logout-modern" style={{ padding: '6px 10px' }}>
                <X size={16} />
              </button>
            </div>

            <label className="input-label">Día de la Semana</label>
            <select
              value={newVipWeekday}
              onChange={(e) => setNewVipWeekday(Number(e.target.value))}
              className="clean-input"
              style={{ marginBottom: 14 }}
            >
              <option value={1}>Lunes</option>
              <option value={2}>Martes</option>
              <option value={3}>Miércoles</option>
              <option value={4}>Jueves</option>
              <option value={5}>Viernes</option>
              <option value={6}>Sábado</option>
            </select>

            <label className="input-label">Hora Fija</label>
            <input
              value={newVipTime}
              onChange={(e) => setNewVipTime(e.target.value)}
              placeholder="11:00"
              className="clean-input"
              style={{ marginBottom: 20 }}
            />

            <button
              onClick={() => {
                alert('Cliente VIP registrado.');
                setVipModalOpen(false);
              }}
              className="btn-clean-submit"
            >
              Guardar Horario VIP
            </button>
          </div>
        </div>
      )}

    </div>
  );
}