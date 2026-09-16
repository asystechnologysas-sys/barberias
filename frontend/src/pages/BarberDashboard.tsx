import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, LogOut, Lock, Unlock, X, ChevronLeft, ChevronRight, AlertTriangle, UserCheck, ShieldAlert } from 'lucide-react';
import { api } from '../api';

export default function BarberDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'schedule' | 'vips'>('schedule');

  const userStr = localStorage.getItem('asys_user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [vips, setVips] = useState<any[]>([]);
  const [clientList, setClientList] = useState<any[]>([]);

  // Modales
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [slotToBlock, setSlotToBlock] = useState<string>('');
  const [blockReason, setBlockReason] = useState('Descanso');

  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [newVipWeekday, setNewVipWeekday] = useState(6);
  const [newVipTime, setNewVipTime] = useState('11:00');
  const [selectedClientId, setSelectedClientId] = useState('');

  const [confirmModal, setConfirmModal] = useState<{ open: boolean; id: string; name: string } | null>(null);
  const [blockDayModal, setBlockDayModal] = useState(false);

  const masterHours = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

  const loadData = async () => {
    try {
      const [appData, blockData, vipData, clients] = await Promise.all([
        api.get('/api/appointments').catch(() => []),
        api.get('/api/blocks').catch(() => []),
        api.get('/api/vip').catch(() => []),
        api.get('/api/clients').catch(() => [])
      ]);
      setAppointments(appData || []);
      setBlocks(blockData || []);
      setVips(vipData || []);
      setClientList(clients || []);
      if (clients?.length) setSelectedClientId(clients[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getHour = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Días del mes en el almanaque
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    const dateStr = d.toISOString().split('T')[0];
    const dayApts = appointments.filter(a => a.startsAt.startsWith(dateStr) && a.status === 'CONFIRMED');
    const dayBlocks = blocks.filter(b => b.startsAt.startsWith(dateStr));
    return {
      dayNum: i + 1,
      dateStr,
      occupiedCount: dayApts.length + dayBlocks.length
    };
  });

  // Acciones
  const handleBlockSlot = async () => {
    try {
      const startsAt = new Date(`${selectedDate}T${slotToBlock}:00-05:00`);
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
      await api.post('/api/blocks', { startsAt, endsAt, reason: blockReason });
      setBlockModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al bloquear');
    }
  };

  // Bloquear día completo
  const handleBlockFullDay = async () => {
    try {
      await api.post('/api/blocks/day', { dateStr: selectedDate, reason: 'Día No Laborable' });
      setBlockDayModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al bloquear día');
    }
  };

  const handleUnblock = async (blockId: string) => {
    try {
      await api.delete(`/api/blocks/${blockId}`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al liberar hora');
    }
  };

  const handleCancelAppointment = async () => {
    if (!confirmModal) return;
    try {
      await api.patch(`/api/appointments/${confirmModal.id}/cancel`, {});
      setConfirmModal(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al cancelar');
    }
  };

  const handleCreateVip = async () => {
    if (!selectedClientId) return alert('Selecciona un cliente de la lista.');
    try {
      await api.post('/api/vip', {
        clientId: selectedClientId,
        weekday: Number(newVipWeekday),
        time: newVipTime,
        frequency: 'WEEKLY'
      });
      setVipModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al asignar VIP');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');
    navigate('/login');
  };

  return (
    <div className="admin-page-wrap">
      {/* Encabezado */}
      <header className="client-top-bar">
        <div className="client-brand-area">
          <div className="barber-logo-placeholder">AS</div>
          <div className="client-welcome-greeting">
            <b>Panel del Barbero · ASYS Barber</b>
            <span>{currentUser ? `👋 Hola, ${currentUser.name}` : 'Control Diario'}</span>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-logout-modern">
          <LogOut size={15} /> Cerrar sesión
        </button>
      </header>

      <div className="admin-layout-clean">
        {/* Barra Lateral */}
        <div className="admin-sidebar-card">
          <span className="cal-eyebrow">ADMINISTRACIÓN</span>
          <h3 style={{ fontFamily: 'Sora', fontSize: 22, marginTop: 4, marginBottom: 16 }}>Control Diario</h3>

          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Citas para hoy</span>
            <b style={{ display: 'block', fontSize: 26, fontFamily: 'Sora', color: 'var(--primary-blue)' }}>
              {appointments.filter(a => a.startsAt.startsWith(new Date().toISOString().split('T')[0]) && a.status === 'CONFIRMED').length}
            </b>
          </div>

          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Total Citas del Mes</span>
            <b style={{ display: 'block', fontSize: 26, fontFamily: 'Sora' }}>
              {appointments.filter(a => a.status === 'CONFIRMED').length}
            </b>
          </div>

          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Clientes VIP</span>
            <b style={{ display: 'block', fontSize: 26, fontFamily: 'Sora', color: '#d97706' }}>
              {vips.length}
            </b>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 10 }}>
            <button onClick={() => setActiveTab('schedule')} className={`admin-nav-btn ${activeTab === 'schedule' ? 'active' : ''}`}>
              <Calendar size={16} /> Almanaque Máster
            </button>
            <button onClick={() => setActiveTab('vips')} className={`admin-nav-btn ${activeTab === 'vips' ? 'active' : ''}`}>
              <Users size={16} /> Clientes VIP Recurrentes
            </button>
          </div>
        </div>

        {/* Panel Central */}
        <div>
          {activeTab === 'schedule' ? (
            <div className="client-calendar-card">
              
              {/* Controles de Navegación del Mes */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <span className="cal-eyebrow">ALMANAQUE GENERAL</span>
                  <h2 style={{ fontFamily: 'Sora', fontSize: 22, textTransform: 'capitalize' }}>
                    {viewDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="btn-dark" style={{ padding: '6px 10px' }}>
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="btn-dark" style={{ padding: '6px 10px' }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Días del Mes */}
              <div className="cal-days-grid" style={{ marginBottom: 20 }}>
                {monthDays.map(d => (
                  <div
                    key={d.dateStr}
                    onClick={() => setSelectedDate(d.dateStr)}
                    className={`cal-cell ${selectedDate === d.dateStr ? 'cell-selected' : ''}`}
                    style={{ minHeight: 64, textAlign: 'center' }}
                  >
                    <div className="cal-cell-num">{d.dayNum}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: d.occupiedCount > 0 ? '#1554ff' : '#10b981' }}>
                      {d.occupiedCount > 0 ? `${d.occupiedCount} turno(s)` : 'Libre'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Barra de herramientas del día seleccionado */}
              <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: 14, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <b>Horas para: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</b>
                <button onClick={() => setBlockDayModal(true)} className="btn-action-sm btn-cancel">
                  🚫 Marcar Día Completo como Cerrado
                </button>
              </div>

              {/* PARRILLA DE CADA HORA */}
              <div className="master-slots-container">
                {masterHours.map(h => {
                  const apt = appointments.find(a => a.startsAt.startsWith(selectedDate) && getHour(a.startsAt) === h && a.status === 'CONFIRMED');
                  const blk = blocks.find(b => b.startsAt.startsWith(selectedDate) && getHour(b.startsAt) === h);

                  if (apt) {
                    return (
                      <div key={h} className="master-slot-row slot-booked">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span className="slot-time-badge">{h}</span>
                          <div>
                            <span className="slot-status-pill booked">● Cita Reservada</span>
                            <b style={{ display: 'block', fontSize: 15, marginTop: 4, color: '#0b1020' }}>{apt.clientName}</b>
                            <span style={{ fontSize: 12, color: '#64748b' }}>Tel: {apt.clientPhone} · {apt.service?.name}</span>
                          </div>
                        </div>
                        <button onClick={() => setConfirmModal({ open: true, id: apt.id, name: apt.clientName })} className="btn-action-sm btn-cancel">
                          Cancelar Cita
                        </button>
                      </div>
                    );
                  }

                  if (blk) {
                    return (
                      <div key={h} className="master-slot-row slot-blocked">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span className="slot-time-badge">{h}</span>
                          <div>
                            <span className="slot-status-pill blocked">🔒 Bloqueada por ti</span>
                            <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginTop: 2 }}>Motivo: {blk.reason}</span>
                          </div>
                        </div>
                        <button onClick={() => handleUnblock(blk.id)} className="btn-action-sm btn-unblock">
                          <Unlock size={12} style={{ display: 'inline', marginRight: 4 }} /> Liberar Hora
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div key={h} className="master-slot-row slot-free">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span className="slot-time-badge">{h}</span>
                        <span className="slot-status-pill free">● Disponible para Clientes</span>
                      </div>
                      <button onClick={() => { setSlotToBlock(h); setBlockModalOpen(true); }} className="btn-action-sm btn-block">
                        <Lock size={12} style={{ display: 'inline', marginRight: 4 }} /> Bloquear
                      </button>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : (
            /* PESTAÑA CLIENTES VIP */
            <div className="client-calendar-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <span className="cal-eyebrow">FIDELIZACIÓN VIP</span>
                  <h2 style={{ fontFamily: 'Sora', fontSize: 22 }}>Clientes VIP con Turno Fijo Semanal</h2>
                </div>
                <button onClick={() => setVipModalOpen(true)} className="btn-clean-submit" style={{ padding: '8px 18px', width: 'auto' }}>
                  + Asignar Nuevo VIP
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {vips.length === 0 ? (
                  <p style={{ color: '#64748b', padding: 20, textAlign: 'center' }}>No tienes clientes VIP registrados todavía.</p>
                ) : (
                  vips.map(v => (
                    <div key={v.id} className="vip-card-clean">
                      <div>
                        <b>{v.client?.name || 'Cliente VIP'}</b>
                        <span style={{ fontSize: 13, color: '#64748b', display: 'block', marginTop: 2 }}>
                          📱 {v.client?.phone} · Día {v.weekday === 6 ? 'Sábado' : v.weekday === 5 ? 'Viernes' : `Día ${v.weekday}`} a las {v.time}
                        </span>
                      </div>
                      <button onClick={() => api.delete(`/api/vip/${v.id}`).then(loadData)} className="btn-action-sm btn-cancel">
                        Eliminar VIP
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL BLOQUEAR HORA INDIVIDUAL */}
      {blockModalOpen && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontFamily: 'Sora', fontSize: 18 }}>Bloquear Hora {slotToBlock}</h3>
              <button onClick={() => setBlockModalOpen(false)} className="btn-dark" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
              Los clientes no podrán reservar esta hora para el día <b>{selectedDate}</b>.
            </p>
            <label className="input-label">Motivo</label>
            <input value={blockReason} onChange={e => setBlockReason(e.target.value)} className="clean-input" style={{ marginBottom: 16 }} />
            <button onClick={handleBlockSlot} className="btn-clean-submit">Confirmar Bloqueo</button>
          </div>
        </div>
      )}

      {/* MODAL BLOQUEAR DÍA COMPLETO */}
      {blockDayModal && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
              <ShieldAlert size={26} />
            </div>
            <h3 style={{ fontFamily: 'Sora', fontSize: 19, marginBottom: 8 }}>¿Cerrar todo el día {selectedDate}?</h3>
            <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
              Ninguna hora estará disponible para agendamiento en este día.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setBlockDayModal(false)} className="btn-dark" style={{ width: '50%' }}>Cancelar</button>
              <button onClick={handleBlockFullDay} className="btn-action-sm btn-cancel" style={{ width: '50%', padding: 12 }}>Sí, Cerrar Día</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR CANCELACIÓN ASYS */}
      {confirmModal && confirmModal.open && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
              <AlertTriangle size={26} />
            </div>
            <h3 style={{ fontFamily: 'Sora', fontSize: 19, marginBottom: 8 }}>¿Cancelar cita de {confirmModal.name}?</h3>
            <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
              La cita se cancelará y la hora volverá a quedar disponible para otros clientes.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmModal(null)} className="btn-dark" style={{ width: '50%' }}>No, mantener</button>
              <button onClick={handleCancelAppointment} className="btn-action-sm btn-cancel" style={{ width: '50%', padding: 12 }}>Sí, cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR CLIENTE VIP */}
      {vipModalOpen && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Sora', fontSize: 18 }}>Asignar Cliente VIP</h3>
              <button onClick={() => setVipModalOpen(false)} className="btn-dark" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            <label className="input-label">Selecciona el Cliente</label>
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="clean-input"
              style={{ marginBottom: 14 }}
            >
              {clientList.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>

            <label className="input-label">Día Fijo de la Semana</label>
            <select
              value={newVipWeekday}
              onChange={e => setNewVipWeekday(Number(e.target.value))}
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

            <label className="input-label">Hora Fija Semanal</label>
            <input
              value={newVipTime}
              onChange={e => setNewVipTime(e.target.value)}
              placeholder="11:00"
              className="clean-input"
              style={{ marginBottom: 20 }}
            />

            <button onClick={handleCreateVip} className="btn-clean-submit">
              Guardar Cliente VIP Recurrente
            </button>
          </div>
        </div>
      )}

    </div>
  );
}