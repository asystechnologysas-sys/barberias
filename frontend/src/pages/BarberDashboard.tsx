import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, LogOut, Lock, Unlock, X, ChevronLeft, ChevronRight, AlertTriangle, ShieldAlert, Crown, Settings, MessageSquare, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api';

export default function BarberDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'schedule' | 'vips' | 'clients' | 'settings'>('schedule');

  const userStr = localStorage.getItem('asys_user');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [vips, setVips] = useState<any[]>([]);
  const [clientList, setClientList] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [weeklySchedules, setWeeklySchedules] = useState<any[]>([]);

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

  // Alerta ASYS flotante
  const [alertModal, setAlertModal] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAlertModal({ open: true, title, message, type });
  };

  const masterHoursAll = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const loadData = async () => {
    try {
      const [appData, blockData, vipData, clients, svcs, scheds] = await Promise.all([
        api.get('/api/appointments').catch(() => []),
        api.get('/api/blocks').catch(() => []),
        api.get('/api/vip').catch(() => []),
        api.get('/api/clients').catch(() => []),
        api.get('/api/services').catch(() => []),
        api.get('/api/schedules').catch(() => [])
      ]);
      setAppointments(appData || []);
      setBlocks(blockData || []);
      setVips(vipData || []);
      setClientList(clients || []);
      setServices(svcs || []);
      if (clients?.length && !selectedClientId) setSelectedClientId(clients[0].id);

      if (scheds && scheds.length > 0) {
        setWeeklySchedules(scheds);
      } else {
        const defaults = Array.from({ length: 7 }, (_, i) => ({
          weekday: i,
          openTime: '09:00',
          closeTime: '20:00',
          closed: false
        }));
        setWeeklySchedules(defaults);
      }
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

  // Generación de slots dinámicos según el horario de ese día de la semana
  const getDayWorkingSlots = (weekday: number) => {
    const sched = weeklySchedules.find(s => s.weekday === weekday);
    if (!sched || sched.closed) return [];
    
    const openH = Number(sched.openTime.slice(0, 2));
    const closeH = Number(sched.closeTime.slice(0, 2));
    
    return masterHoursAll.filter(h => {
      const slotH = Number(h.slice(0, 2));
      return slotH >= openH && slotH < closeH;
    });
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const emptyOffset = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  // CÁLCULO REAL DEL SEMÁFORO EN EL ALMANAQUE
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();

    // 1. Verificar si está cerrado
    const isFullDayClosed = blocks.some(b => {
      const bStart = new Date(b.startsAt);
      const bEnd = new Date(b.endsAt);
      return bStart <= new Date(`${dateStr}T00:00:00-05:00`) && bEnd >= new Date(`${dateStr}T23:59:59-05:00`);
    });
    const sched = weeklySchedules.find(s => s.weekday === dayOfWeek);
    const isDayClosed = isFullDayClosed || !!sched?.closed;

    // 2. Calcular slots totales vs libres
    const workingSlots = getDayWorkingSlots(dayOfWeek);
    const totalSlots = workingSlots.length;

    const dayApts = appointments.filter(a => a.startsAt.startsWith(dateStr) && a.status === 'CONFIRMED');
    const dayBlocks = blocks.filter(b => b.startsAt.startsWith(dateStr) && !isFullDayClosed);
    const dayVips = vips.filter(v => {
      if (v.weekday !== dayOfWeek) return false;
      const isSkipped = v.exceptions?.some((e: any) => new Date(e.date).toISOString().split('T')[0] === dateStr);
      return !isSkipped;
    });

    const occupiedSlotsCount = dayApts.length + dayBlocks.length + dayVips.length;
    const freeSlotsCount = Math.max(0, totalSlots - occupiedSlotsCount);

    // Lógica del semáforo
    let status = 'green';
    let statusText = 'Disponible ●';

    if (isDayClosed) {
      status = 'closed';
      statusText = 'Cerrado';
    } else if (totalSlots === 0 || freeSlotsCount === 0) {
      status = 'full';
      statusText = 'Lleno ●';
    } else if (freeSlotsCount <= 2 || (freeSlotsCount / totalSlots) <= 0.5) {
      status = 'yellow';
      statusText = `${freeSlotsCount} libres ●`;
    } else {
      status = 'green';
      statusText = `${freeSlotsCount} libres ●`;
    }

    return {
      dayNum: i + 1,
      dateStr,
      status,
      statusText
    };
  });

  const handleBlockSlot = async () => {
    try {
      const startsAt = new Date(`${selectedDate}T${slotToBlock}:00-05:00`);
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
      await api.post('/api/blocks', { startsAt, endsAt, reason: blockReason });
      setBlockModalOpen(false);
      showAlert('Hora Bloqueada', `La franja de las ${slotToBlock} quedó bloqueada.`);
      loadData();
    } catch (err: any) {
      showAlert('Error al bloquear', err.message || 'No se pudo bloquear la hora', 'error');
    }
  };

  const handleBlockFullDay = async () => {
    try {
      await api.post('/api/blocks/day', { dateStr: selectedDate, reason: 'Día Cerrado' });
      setBlockDayModal(false);
      showAlert('Día Cerrado', `El día ${selectedDate} fue cerrado para reservas.`);
      loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'No se pudo cerrar el día', 'error');
    }
  };

  const handleReopenDay = async () => {
    try {
      await api.delete(`/api/blocks/day/${selectedDate}`);
      showAlert('Día Reabierto', `El día ${selectedDate} vuelve a estar disponible para citas.`);
      loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'No se pudo reabrir el día', 'error');
    }
  };

  const handleUnblock = async (blockId: string) => {
    try {
      await api.delete(`/api/blocks/${blockId}`);
      showAlert('Hora Liberada', 'La franja horaria vuelve a estar disponible para clientes.');
      loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'No se pudo liberar la hora', 'error');
    }
  };

  const handleCancelAppointment = async () => {
    if (!confirmModal) return;
    try {
      await api.patch(`/api/appointments/${confirmModal.id}/cancel`, {});
      setConfirmModal(null);
      showAlert('Cita Cancelada', 'La cita fue cancelada y la hora quedó libre para otros clientes.');
      loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'No se pudo cancelar', 'error');
    }
  };

  const handleCreateVip = async () => {
    if (!selectedClientId) return showAlert('Atención', 'Selecciona un cliente de la lista.', 'info');
    try {
      await api.post('/api/vip', {
        clientId: selectedClientId,
        weekday: Number(newVipWeekday),
        time: newVipTime
      });
      setVipModalOpen(false);
      showAlert('Cliente VIP Asignado', 'El turno fijo semanal quedó registrado con éxito.');
      loadData();
    } catch (err: any) {
      showAlert('Horario No Disponible', err.message || 'Este horario ya está ocupado por otro VIP.', 'error');
    }
  };

  const handleSaveSchedules = async () => {
    try {
      await api.put('/api/schedules', { schedules: weeklySchedules });
      showAlert('¡Horarios Guardados!', 'La configuración semanal de apertura y cierre fue actualizada.');
      loadData();
    } catch (err: any) {
      showAlert('Error al guardar', err.message || 'No se pudo guardar la configuración', 'error');
    }
  };

  const handleUpdateCortePrice = async (serviceId: string, newPrice: number) => {
    try {
      await api.patch(`/api/services/${serviceId}`, { price: newPrice });
      showAlert('Tarifa Actualizada', `El precio del corte ahora es de $${newPrice.toLocaleString('es-CO')} COP.`);
      loadData();
    } catch (err: any) {
      showAlert('Error al actualizar', err.message || 'No se pudo actualizar el precio', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');
    api.post('/api/auth/logout', {}).catch(() => {});
    navigate('/login');
  };

  const selectedDateDayOfWeek = new Date(`${selectedDate}T12:00:00-05:00`).getDay();
  const currentDayWorkingSlots = getDayWorkingSlots(selectedDateDayOfWeek);

  const isCurrentSelectedDayClosed = blocks.some(b => {
    const bStart = new Date(b.startsAt);
    const bEnd = new Date(b.endsAt);
    return bStart <= new Date(`${selectedDate}T00:00:00-05:00`) && bEnd >= new Date(`${selectedDate}T23:59:59-05:00`);
  }) || !!weeklySchedules.find(s => s.weekday === selectedDateDayOfWeek)?.closed;

  // Horas ya ocupadas por VIPs en el día que se está seleccionando en el modal
  const takenVipHoursInSelectedDay = vips
    .filter(v => v.weekday === Number(newVipWeekday))
    .map(v => v.time);

  const corteService = services.find(s => s.name.toLowerCase().includes('corte')) || services[0];

  return (
    <div className="admin-page-wrap">
      
      {/* 1. ENCABEZADO */}
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

      {/* 2. CUERPO PRINCIPAL */}
      <div className="admin-layout-clean">
        
        {/* BARRA LATERAL */}
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
            <span style={{ fontSize: 12, color: '#64748b' }}>Clientes VIP Activos</span>
            <b style={{ display: 'block', fontSize: 26, fontFamily: 'Sora', color: '#d97706' }}>
              {vips.length}
            </b>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 10 }}>
            <button onClick={() => setActiveTab('schedule')} className={`admin-nav-btn ${activeTab === 'schedule' ? 'active' : ''}`}>
              <Calendar size={16} /> Almanaque Máster
            </button>
            <button onClick={() => setActiveTab('vips')} className={`admin-nav-btn ${activeTab === 'vips' ? 'active' : ''}`}>
              <Crown size={16} /> Clientes VIP
            </button>
            <button onClick={() => setActiveTab('clients')} className={`admin-nav-btn ${activeTab === 'clients' ? 'active' : ''}`}>
              <Users size={16} /> Mis Clientes
            </button>
            <button onClick={() => setActiveTab('settings')} className={`admin-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}>
              <Settings size={16} /> Horarios y Precios
            </button>
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div>
          {/* PESTAÑA 1: ALMANAQUE MÁSTER */}
          {activeTab === 'schedule' && (
            <div className="client-calendar-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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

              {/* CALENDARIO CON SEMÁFORO EXACTO */}
              <div className="cal-week-labels">
                <span>DOM</span><span>LUN</span><span>MAR</span><span>MIE</span><span>JUE</span><span>VIE</span><span>SAB</span>
              </div>

              <div className="cal-days-grid" style={{ marginBottom: 20 }}>
                {emptyOffset.map((_, i) => (
                  <div key={`offset-${i}`} className="cal-cell cell-disabled" style={{ opacity: 0.15, minHeight: 64 }}></div>
                ))}

                {monthDays.map(d => {
                  let badgeClass = 'status-green';
                  if (d.status === 'closed') badgeClass = 'status-red';
                  if (d.status === 'full') badgeClass = 'status-red';
                  if (d.status === 'yellow') badgeClass = 'status-yellow';

                  return (
                    <div
                      key={d.dateStr}
                      onClick={() => setSelectedDate(d.dateStr)}
                      className={`cal-cell ${badgeClass} ${selectedDate === d.dateStr ? 'cell-selected' : ''}`}
                      style={{ minHeight: 64, textAlign: 'center' }}
                    >
                      <div className="cal-cell-num">{d.dayNum}</div>
                      <div className="cal-cell-status">{d.statusText}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: 14, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <b>Horas para: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</b>
                
                {isCurrentSelectedDayClosed ? (
                  <button onClick={handleReopenDay} className="btn-action-sm btn-unblock">
                    🔓 Reabrir Día para Clientes
                  </button>
                ) : (
                  <button onClick={() => setBlockDayModal(true)} className="btn-action-sm btn-cancel">
                    🚫 Marcar Día Completo como Cerrado
                  </button>
                )}
              </div>

              {/* LISTA DE HORAS: SOLO LAS HORAS REALES DE SU JORNADA */}
              {isCurrentSelectedDayClosed ? (
                <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 14, padding: 30, textAlign: 'center', color: '#dc2626' }}>
                  <ShieldAlert size={40} style={{ margin: '0 auto 10px' }} />
                  <b style={{ fontSize: 16, display: 'block' }}>Este día se encuentra cerrado</b>
                  <p style={{ fontSize: 13, color: '#7f1d1d', marginTop: 4 }}>Ningún cliente podrá agendar citas en esta fecha.</p>
                </div>
              ) : currentDayWorkingSlots.length === 0 ? (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 30, textAlign: 'center', color: '#64748b' }}>
                  No tienes horas de trabajo configuradas para este día de la semana. Puedes configurarlo en la pestaña "Horarios y Precios".
                </div>
              ) : (
                <div className="master-slots-container">
                  {currentDayWorkingSlots.map(h => {
                    const apt = appointments.find(a => a.startsAt.startsWith(selectedDate) && getHour(a.startsAt) === h && a.status === 'CONFIRMED');
                    const blk = blocks.find(b => b.startsAt.startsWith(selectedDate) && getHour(b.startsAt) === h);
                    
                    const vipSlot = vips.find(v => {
                      if (v.weekday !== selectedDateDayOfWeek || v.time !== h) return false;
                      const hasException = v.exceptions?.some((e: any) => new Date(e.date).toISOString().split('T')[0] === selectedDate);
                      return !hasException;
                    });

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

                    if (vipSlot) {
                      return (
                        <div key={h} className="master-slot-row" style={{ borderLeft: '5px solid #d97706', background: '#fffbeb' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <span className="slot-time-badge">{h}</span>
                            <div>
                              <span className="slot-status-pill" style={{ background: '#fef3c7', color: '#b45309' }}>👑 Turno Fijo VIP Semanal</span>
                              <b style={{ display: 'block', fontSize: 15, marginTop: 4, color: '#0b1020' }}>{vipSlot.client?.name}</b>
                              <span style={{ fontSize: 12, color: '#64748b' }}>Tel: {vipSlot.client?.phone} · Turno habitual semanal</span>
                            </div>
                          </div>
                          <button onClick={() => api.delete(`/api/vip/${vipSlot.id}`).then(loadData)} className="btn-action-sm btn-cancel">
                            Eliminar Turno VIP
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
                          <span className="slot-status-pill free">● Disponible</span>
                        </div>
                        <button onClick={() => { setSlotToBlock(h); setBlockModalOpen(true); }} className="btn-action-sm btn-block">
                          <Lock size={12} style={{ display: 'inline', marginRight: 4 }} /> Bloquear
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 2: VIPs */}
          {activeTab === 'vips' && (
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
                  <p style={{ color: '#64748b', padding: 20, textAlign: 'center' }}>No hay clientes VIP registrados todavía.</p>
                ) : (
                  vips.map(v => (
                    <div key={v.id} className="vip-card-clean">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Crown size={15} color="#d97706" />
                          <b>{v.client?.name}</b>
                          <span className="vip-badge-blue">VIP FIJO</span>
                        </div>
                        <span style={{ fontSize: 13, color: '#64748b', display: 'block', marginTop: 3 }}>
                          📱 {v.client?.phone} · Día {dayNames[v.weekday]} a las {v.time} (Semanal)
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

          {/* PESTAÑA 3: MIS CLIENTES */}
          {activeTab === 'clients' && (
            <div className="table-card-saas">
              <div className="table-saas-header">
                <div>
                  <span className="cal-eyebrow">DIRECTORIO DE CLIENTES</span>
                  <h2 style={{ fontFamily: 'Sora', fontSize: 22, marginTop: 4 }}>Clientes de la Barbería</h2>
                </div>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Total: {clientList.length} registrados</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table-saas">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Celular</th>
                      <th>Citas Acumuladas</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientList.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>No hay clientes registrados aún.</td></tr>
                    ) : (
                      clientList.map(c => {
                        const cleanPhone = c.phone?.replace(/[^0-9]/g, '');
                        const fullPhone = cleanPhone?.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
                        const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(`Hola ${c.name}, te escribimos de ASYS Barber.`)}`;
                        const isVip = c.vipSchedules?.length > 0;

                        return (
                          <tr key={c.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div className="client-avatar-circle">{c.name.slice(0, 2).toUpperCase()}</div>
                                <b style={{ color: '#0b1020', fontSize: 15 }}>{c.name}</b>
                              </div>
                            </td>
                            <td style={{ fontFamily: 'Sora', fontWeight: 600, color: '#334155' }}>
                              {c.phone}
                            </td>
                            <td>
                              <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: 12, fontWeight: 700, fontSize: 12 }}>
                                {c._count?.appointments || 0} cita(s)
                              </span>
                            </td>
                            <td>
                              {isVip ? (
                                <span style={{ color: '#d97706', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fffbeb', border: '1px solid #fde68a', padding: '3px 10px', borderRadius: 14, fontSize: 11 }}>
                                  <Crown size={12} color="#f59e0b" /> VIP
                                </span>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>Regular</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn-whatsapp-chat">
                                <MessageSquare size={13} /> Enviar WhatsApp
                              </a>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PESTAÑA 4: HORARIOS Y PRECIO DEL CORTE */}
          {activeTab === 'settings' && (
            <div>
              <div className="client-calendar-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <span className="cal-eyebrow">JORNADA SEMANAL</span>
                    <h2 style={{ fontFamily: 'Sora', fontSize: 22 }}>Horarios de Apertura por Día</h2>
                    <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                      Activa o desactiva días fijos y define a qué hora abres y cierras cada día.
                    </p>
                  </div>
                  <button onClick={handleSaveSchedules} className="btn-clean-submit" style={{ width: 'auto', padding: '10px 22px' }}>
                    <Save size={15} style={{ display: 'inline', marginRight: 6 }} /> Guardar Horarios
                  </button>
                </div>

                <div>
                  {weeklySchedules.map((s, idx) => (
                    <div key={s.weekday} className={`schedule-day-row ${s.closed ? 'day-closed' : ''}`}>
                      <div style={{ width: 140 }}>
                        <b style={{ fontSize: 16, display: 'block' }}>{dayNames[s.weekday]}</b>
                        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 4 }}>
                          <input
                            type="checkbox"
                            checked={!s.closed}
                            onChange={e => {
                              const copy = [...weeklySchedules];
                              copy[idx].closed = !e.target.checked;
                              setWeeklySchedules(copy);
                            }}
                          />
                          <span style={{ color: !s.closed ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                            {!s.closed ? 'Laborable' : 'Cerrado / Descanso'}
                          </span>
                        </label>
                      </div>

                      {!s.closed ? (
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Apertura</span>
                            <select
                              value={s.openTime}
                              onChange={e => {
                                const copy = [...weeklySchedules];
                                copy[idx].openTime = e.target.value;
                                setWeeklySchedules(copy);
                              }}
                              className="clean-input"
                              style={{ padding: '6px 10px', fontSize: 13, width: 100 }}
                            >
                              {masterHoursAll.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>

                          <span style={{ marginTop: 16, color: '#94a3b8' }}>a</span>

                          <div>
                            <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Cierre</span>
                            <select
                              value={s.closeTime}
                              onChange={e => {
                                const copy = [...weeklySchedules];
                                copy[idx].closeTime = e.target.value;
                                setWeeklySchedules(copy);
                              }}
                              className="clean-input"
                              style={{ padding: '6px 10px', fontSize: 13, width: 100 }}
                            >
                              {masterHoursAll.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>
                          Este día no se ofrecerán turnos a clientes.
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* TARIFA DEL CORTE PRINCIPAL */}
              {corteService && (
                <div className="client-calendar-card">
                  <span className="cal-eyebrow">TARIFA PRINCIPAL</span>
                  <h2 style={{ fontFamily: 'Sora', fontSize: 22, marginBottom: 8 }}>Precio del Corte</h2>
                  <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
                    Define el valor del corte en pesos colombianos. Los clientes verán este precio actualizado de inmediato.
                  </p>

                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', maxWidth: 460 }}>
                    <div style={{ flex: 1 }}>
                      <label className="input-label">Precio del Corte (COP)</label>
                      <input
                        type="number"
                        defaultValue={corteService.price}
                        id={`price-${corteService.id}`}
                        className="clean-input"
                        placeholder="Ej. 25000"
                      />
                    </div>

                    <button
                      onClick={() => {
                        const newPrice = Number((document.getElementById(`price-${corteService.id}`) as HTMLInputElement).value);
                        handleUpdateCortePrice(corteService.id, newPrice);
                      }}
                      className="btn-clean-submit"
                      style={{ width: 'auto', padding: '13px 24px' }}
                    >
                      Actualizar Precio
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* MODAL BLOQUEAR HORA */}
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

      {/* MODAL CERRAR DÍA COMPLETO */}
      {blockDayModal && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 430, textAlign: 'center' }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
              <ShieldAlert size={28} />
            </div>
            <h3 style={{ fontFamily: 'Sora', fontSize: 19, marginBottom: 8 }}>¿Cerrar todo el día {selectedDate}?</h3>
            <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
              ¿Estás seguro? Al cerrar el día, <b>todas las horas quedarán bloqueadas de inmediato</b> y ningún cliente podrá reservar en esta fecha.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setBlockDayModal(false)} className="btn-dark" style={{ width: '50%' }}>Cancelar</button>
              <button onClick={handleBlockFullDay} className="btn-action-sm btn-cancel" style={{ width: '50%', padding: 12 }}>Sí, Cerrar Día</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR CLIENTE VIP CON VALIDACIÓN DE HORAS OCUPADAS */}
      {vipModalOpen && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Sora', fontSize: 18 }}>Asignar Turno Fijo a Cliente VIP</h3>
              <button onClick={() => setVipModalOpen(false)} className="btn-dark" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            <label className="input-label">Selecciona el Cliente Registrado</label>
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
              <option value={0}>Domingo</option>
            </select>

            {/* Selector de Horas con horas ocupadas deshabilitadas */}
            <label className="input-label">Hora Fija Semanal</label>
            <select
              value={newVipTime}
              onChange={e => setNewVipTime(e.target.value)}
              className="clean-input"
              style={{ marginBottom: 20 }}
            >
              {masterHoursAll.map(h => {
                const isTaken = takenVipHoursInSelectedDay.includes(h);
                return (
                  <option key={h} value={h} disabled={isTaken}>
                    {h} {isTaken ? '(Ocupado por otro VIP)' : ''}
                  </option>
                );
              })}
            </select>

            <button onClick={handleCreateVip} className="btn-clean-submit">
              Guardar Cliente VIP Recurrente
            </button>
          </div>
        </div>
      )}

      {/* MODAL CANCELAR CITA */}
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

      {/* VENTANA MODAL DE ALERTAS ASYS */}
      {alertModal && alertModal.open && (
        <div className="modal-hours-overlay">
          <div className="asys-alert-modal">
            <div className={`asys-alert-icon ${alertModal.type}`}>
              {alertModal.type === 'success' && <CheckCircle2 size={32} />}
              {alertModal.type === 'error' && <AlertCircle size={32} />}
              {alertModal.type === 'info' && <CheckCircle2 size={32} />}
            </div>
            <h3 style={{ fontFamily: 'Sora', fontSize: 20, marginBottom: 8, color: '#0b1020' }}>{alertModal.title}</h3>
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5, marginBottom: 22 }}>
              {alertModal.message}
            </p>
            <button onClick={() => setAlertModal(null)} className="btn-clean-submit">
              Aceptar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}