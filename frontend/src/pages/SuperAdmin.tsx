import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, Plus, ExternalLink, LogOut, CheckCircle2, PauseCircle,
  PlayCircle, Users, Scissors, CalendarCheck2, ShieldAlert, Sparkles,
  Edit2, Trash2, X, RefreshCw
} from 'lucide-react';
import { api } from '../api';

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({
    totalOrganizations: 0,
    active: 0,
    suspended: 0,
    totalBarbers: 0,
    totalAppointments: 0,
    totalClients: 0
  });

  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{ open: boolean; org: any | null }>({ open: false, org: null });

  // Form states
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [maxBarbers, setMaxBarbers] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  // Modal de notificación ASYS
  const [alertModal, setAlertModal] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAlertModal({ open: true, title, message, type });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([
        api.get('/api/superadmin/stats'),
        api.get('/api/superadmin/organizations')
      ]);
      setStats(s || {});
      setOrgs(o || []);
    } catch (err: any) {
      console.error(err);
      showAlert('Error al cargar', err.message || 'No se pudieron obtener las organizaciones', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    if (!name || !cleanSlug) return showAlert('Datos Incompletos', 'Nombre y slug son obligatorios', 'info');

    setSubmitting(true);
    try {
      await api.post('/api/superadmin/organizations', {
        name,
        slug: cleanSlug,
        logoUrl: logoUrl.trim() || undefined,
        maxBarbers: Number(maxBarbers) || 5
      });
      setCreateModal(false);
      setName('');
      setSlug('');
      setLogoUrl('');
      showAlert('¡Barbería Creada!', `La barbería ${name} fue registrada con éxito en el sistema.`);
      loadData();
    } catch (err: any) {
      showAlert('Error al crear', err.message || 'No se pudo crear la barbería', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.org) return;

    setSubmitting(true);
    try {
      await api.patch(`/api/superadmin/organizations/${editModal.org.id}`, {
        name: editModal.org.name,
        logoUrl: editModal.org.logoUrl || null,
        maxBarbers: Number(editModal.org.maxBarbers) || 5
      });
      setEditModal({ open: false, org: null });
      showAlert('Barbería Actualizada', 'Los datos de la barbería se actualizaron correctamente.');
      loadData();
    } catch (err: any) {
      showAlert('Error al actualizar', err.message || 'No se pudo actualizar', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (org: any) => {
    const nextStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.patch(`/api/superadmin/organizations/${org.id}`, { status: nextStatus });
      showAlert(
        nextStatus === 'ACTIVE' ? 'Suscripción Activada' : 'Suscripción Pausada',
        nextStatus === 'ACTIVE'
          ? `La barbería ${org.name} ya está disponible para agendamientos.`
          : `La barbería ${org.name} ha sido pausada y no permitirá agendar turnos.`
      );
      loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'No se pudo cambiar el estado', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');
    api.post('/api/auth/logout', {}).catch(() => {});
    navigate('/login');
  };

  return (
    <div className="admin-page-wrap">

      {/* HEADER SUPERADMIN ASYS */}
      <header className="client-top-bar">
        <div className="client-brand-area">
          <div className="barber-logo-placeholder" style={{ background: '#eff6ff', color: '#1554ff' }}>
            A
          </div>
          <div className="client-welcome-greeting">
            <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              ASYS CONTROL MASTER <Sparkles size={16} color="#1554ff" />
            </b>
            <span>Panel Central de Administración Multi-Tenant</span>
          </div>
        </div>

        <button onClick={handleLogout} className="btn-logout-modern">
          <LogOut size={15} /> Cerrar sesión
        </button>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <div style={{ maxWidth: 1280, margin: '28px auto 0', padding: '0 20px' }}>

        {/* TÍTULO Y BOTÓN DE ACCIÓN */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span className="cal-eyebrow">ADMINISTRADOR GLOBAL</span>
            <h1 style={{ fontFamily: 'Sora', fontSize: 26, color: '#0b1020', marginTop: 2 }}>Control de Barberías</h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
              Administra todas las barberías suscritas, su estado de servicio y sus enlaces únicos de clientes.
            </p>
          </div>
          <button onClick={() => setCreateModal(true)} className="btn-clean-submit" style={{ width: 'auto', padding: '10px 22px' }}>
            <Plus size={16} style={{ display: 'inline', marginRight: 6 }} /> Registrar Nueva Barbería
          </button>
        </div>

        {/* TARJETAS DE MÉTRICAS GLOBALES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
          
          <div className="client-summary-card" style={{ padding: '18px 20px' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={15} color="#1554ff" /> Total Barberías
            </span>
            <b style={{ fontSize: 28, fontFamily: 'Sora', color: '#0b1020', display: 'block', marginTop: 8 }}>
              {stats.totalOrganizations}
            </b>
          </div>

          <div className="client-summary-card" style={{ padding: '18px 20px' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={15} color="#16a34a" /> Activas
            </span>
            <b style={{ fontSize: 28, fontFamily: 'Sora', color: '#16a34a', display: 'block', marginTop: 8 }}>
              {stats.active}
            </b>
          </div>

          <div className="client-summary-card" style={{ padding: '18px 20px' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PauseCircle size={15} color="#dc2626" /> Pausadas
            </span>
            <b style={{ fontSize: 28, fontFamily: 'Sora', color: '#dc2626', display: 'block', marginTop: 8 }}>
              {stats.suspended}
            </b>
          </div>

          <div className="client-summary-card" style={{ padding: '18px 20px' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Scissors size={15} color="#0284c7" /> Barberos Registrados
            </span>
            <b style={{ fontSize: 28, fontFamily: 'Sora', color: '#0284c7', display: 'block', marginTop: 8 }}>
              {stats.totalBarbers}
            </b>
          </div>

          <div className="client-summary-card" style={{ padding: '18px 20px' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarCheck2 size={15} color="#1554ff" /> Total Citas
            </span>
            <b style={{ fontSize: 28, fontFamily: 'Sora', color: '#1554ff', display: 'block', marginTop: 8 }}>
              {stats.totalAppointments}
            </b>
          </div>

          <div className="client-summary-card" style={{ padding: '18px 20px' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={15} color="#7c3aed" /> Clientes
            </span>
            <b style={{ fontSize: 28, fontFamily: 'Sora', color: '#7c3aed', display: 'block', marginTop: 8 }}>
              {stats.totalClients || 0}
            </b>
          </div>

        </div>

        {/* TABLA SAAS DE BARBERÍAS */}
        <div className="table-card-saas">
          <div className="table-saas-header">
            <div>
              <span className="cal-eyebrow">DIRECTORIO DE CLIENTES SAAS</span>
              <h2 style={{ fontFamily: 'Sora', fontSize: 20, marginTop: 2 }}>Barberías Suscritas</h2>
            </div>
            <button onClick={loadData} className="btn-logout-modern" style={{ padding: '6px 14px' }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table-saas">
              <thead>
                <tr>
                  <th>Barbería</th>
                  <th>Link Público Cliente</th>
                  <th>Barberos</th>
                  <th>Citas</th>
                  <th>Clientes</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orgs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>
                      {loading ? 'Cargando barberías...' : 'No hay barberías registradas.'}
                    </td>
                  </tr>
                ) : (
                  orgs.map((o) => {
                    const isActive = o.status === 'ACTIVE';
                    return (
                      <tr key={o.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {o.logoUrl ? (
                              <img
                                src={o.logoUrl}
                                alt={o.name}
                                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #e2e8f0' }}
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="client-avatar-circle" style={{ width: 40, height: 40, fontSize: 14 }}>
                                {o.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <b style={{ color: '#0b1020', fontSize: 15, display: 'block' }}>{o.name}</b>
                              <span style={{ fontSize: 11, color: '#64748b' }}>Slug: {o.slug}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <Link
                            to={`/b/${o.slug}`}
                            target="_blank"
                            style={{
                              color: '#1554ff',
                              fontWeight: 700,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: 13,
                              background: '#eff6ff',
                              padding: '5px 12px',
                              borderRadius: 20,
                              border: '1px solid #bfdbfe'
                            }}
                          >
                            /b/{o.slug} <ExternalLink size={12} />
                          </Link>
                        </td>

                        <td style={{ fontWeight: 600 }}>{o._count?.barbers ?? 0} barbero(s)</td>
                        <td style={{ fontWeight: 600 }}>{o._count?.appointments ?? 0}</td>
                        <td style={{ fontWeight: 600 }}>{o._count?.clients ?? 0}</td>

                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '4px 10px',
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 800,
                              background: isActive ? '#f0fdf4' : '#fef2f2',
                              color: isActive ? '#16a34a' : '#dc2626',
                              border: `1px solid ${isActive ? '#bbf7d0' : '#fecaca'}`
                            }}
                          >
                            {isActive ? '● ACTIVA' : '● PAUSADA'}
                          </span>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              onClick={() => setEditModal({ open: true, org: { ...o } })}
                              className="btn-action-sm btn-block"
                              title="Editar datos y logo"
                            >
                              <Edit2 size={13} style={{ display: 'inline', marginRight: 4 }} /> Editar
                            </button>

                            <button
                              onClick={() => toggleStatus(o)}
                              className={`btn-action-sm ${isActive ? 'btn-cancel' : 'btn-unblock'}`}
                            >
                              {isActive ? (
                                <>
                                  <PauseCircle size={13} style={{ display: 'inline', marginRight: 4 }} /> Pausar
                                </>
                              ) : (
                                <>
                                  <PlayCircle size={13} style={{ display: 'inline', marginRight: 4 }} /> Activar
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL CREAR BARBERÍA */}
      {createModal && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span className="cal-eyebrow">NUEVO NEGOCIO SAAS</span>
                <h3 style={{ fontFamily: 'Sora', fontSize: 19, marginTop: 2 }}>Registrar Barbería</h3>
              </div>
              <button onClick={() => setCreateModal(false)} className="btn-logout-modern" style={{ padding: '6px 10px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="input-group">
                <label className="input-label">Nombre de la Barbería</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Barbería Élite Roma"
                  className="clean-input"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) {
                      setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]/g, '-'));
                    }
                  }}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Slug de Acceso (URL del Negocio)</label>
                <input
                  type="text"
                  required
                  placeholder="ej. elite-roma"
                  className="clean-input"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
                <small style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 4 }}>
                  Su enlace será: <b>app.asysdigital.com/b/{slug || 'nombre-slug'}</b>
                </small>
              </div>

              <div className="input-group">
                <label className="input-label">URL del Logo (Opcional)</label>
                <input
                  type="url"
                  placeholder="https://... (enlace de la imagen)"
                  className="clean-input"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Límite Máximo de Barberos</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="clean-input"
                  value={maxBarbers}
                  onChange={(e) => setMaxBarbers(Number(e.target.value))}
                />
              </div>

              <button type="submit" disabled={submitting} className="btn-clean-submit" style={{ marginTop: 10 }}>
                {submitting ? 'Creando negocio...' : 'Crear y Habilitar Barbería →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR BARBERÍA */}
      {editModal.open && editModal.org && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span className="cal-eyebrow">EDITAR TENANT</span>
                <h3 style={{ fontFamily: 'Sora', fontSize: 19, marginTop: 2 }}>{editModal.org.name}</h3>
              </div>
              <button onClick={() => setEditModal({ open: false, org: null })} className="btn-logout-modern" style={{ padding: '6px 10px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdate}>
              <div className="input-group">
                <label className="input-label">Nombre</label>
                <input
                  type="text"
                  required
                  className="clean-input"
                  value={editModal.org.name}
                  onChange={(e) => setEditModal({ ...editModal, org: { ...editModal.org, name: e.target.value } })}
                />
              </div>

              <div className="input-group">
                <label className="input-label">URL del Logo</label>
                <input
                  type="url"
                  placeholder="https://..."
                  className="clean-input"
                  value={editModal.org.logoUrl || ''}
                  onChange={(e) => setEditModal({ ...editModal, org: { ...editModal.org, logoUrl: e.target.value } })}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Máx. Barberos Permitidos</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="clean-input"
                  value={editModal.org.maxBarbers}
                  onChange={(e) => setEditModal({ ...editModal, org: { ...editModal.org, maxBarbers: Number(e.target.value) } })}
                />
              </div>

              <button type="submit" disabled={submitting} className="btn-clean-submit" style={{ marginTop: 10 }}>
                {submitting ? 'Guardando...' : 'Guardar Cambios →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ALERTAS ASYS */}
      {alertModal && alertModal.open && (
        <div className="modal-hours-overlay">
          <div className="asys-alert-modal">
            <div className={`asys-alert-icon ${alertModal.type}`}>
              {alertModal.type === 'success' && <CheckCircle2 size={32} />}
              {alertModal.type === 'error' && <ShieldAlert size={32} />}
              {alertModal.type === 'info' && <Sparkles size={32} />}
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