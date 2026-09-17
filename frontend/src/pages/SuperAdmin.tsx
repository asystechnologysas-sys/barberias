import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, Plus, ExternalLink, LogOut, CheckCircle2, PauseCircle,
  PlayCircle, Users, Scissors, CalendarCheck2, ShieldAlert, Sparkles,
  Edit2, Trash2, X, RefreshCw, Upload, Image as ImageIcon
} from 'lucide-react';
import { api } from '../api';

export default function SuperAdmin() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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
  const [barbersModal, setBarbersModal] = useState<{ open: boolean; org: any | null }>({ open: false, org: null });

  // Form states creación
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [maxBarbers, setMaxBarbers] = useState(5);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  const [barberList, setBarberList] = useState<{ name: string; phone: string; priority: number }[]>([
    { name: '', phone: '', priority: 1 }
  ]);

  // Form agregar barbero
  const [newBName, setNewBName] = useState('');
  const [newBPhone, setNewBPhone] = useState('');
  const [newBPriority, setNewBPriority] = useState(1);

  const [submitting, setSubmitting] = useState(false);
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
      showAlert('Error', err.message || 'No se pudieron cargar los datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Manejador de subida de imagen al crear
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    setUploadingLogo(true);
    try {
      const res = await api.upload('/api/superadmin/upload', formData);
      setLogoUrl(res.url);
      showAlert('Imagen Cargada', 'El logo fue subido exitosamente.');
    } catch (err: any) {
      showAlert('Error al subir', err.message || 'No se pudo subir la imagen', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Manejador de subida de imagen al editar
  const handleEditFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editModal.org) return;

    const formData = new FormData();
    formData.append('logo', file);

    setUploadingLogo(true);
    try {
      const res = await api.upload('/api/superadmin/upload', formData);
      setEditModal({ ...editModal, org: { ...editModal.org, logoUrl: res.url } });
      showAlert('Imagen Actualizada', 'Nuevo logo cargado.');
    } catch (err: any) {
      showAlert('Error al subir', err.message || 'No se pudo subir la imagen', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    if (!name || !cleanSlug) return showAlert('Datos Incompletos', 'Nombre y slug son obligatorios', 'info');

    const validBarbers = barberList.filter(b => b.name.trim() && b.phone.trim());

    setSubmitting(true);
    try {
      await api.post('/api/superadmin/organizations', {
        name,
        slug: cleanSlug,
        logoUrl: logoUrl.trim() || undefined,
        maxBarbers: Number(maxBarbers) || 5,
        barbers: validBarbers
      });
      setCreateModal(false);
      setName('');
      setSlug('');
      setLogoUrl('');
      setBarberList([{ name: '', phone: '', priority: 1 }]);
      showAlert('¡Barbería Creada!', `La barbería ${name} fue registrada con éxito.`);
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
      showAlert('Barbería Actualizada', 'Los datos y logo de la barbería se guardaron correctamente.');
      loadData();
    } catch (err: any) {
      showAlert('Error al actualizar', err.message || 'No se pudo actualizar', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBarberToOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbersModal.org || !newBName || !newBPhone) return;

    setSubmitting(true);
    try {
      await api.post(`/api/superadmin/organizations/${barbersModal.org.id}/barbers`, {
        name: newBName,
        phone: newBPhone,
        priority: Number(newBPriority)
      });
      setNewBName('');
      setNewBPhone('');
      showAlert('Barbero Autorizado', `${newBName} ya puede ingresar a la barbería.`);
      loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'No se pudo autorizar al barbero', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAllowedBarber = async (allowedId: string) => {
    if (!barbersModal.org) return;
    try {
      await api.delete(`/api/superadmin/organizations/${barbersModal.org.id}/barbers/${allowedId}`);
      showAlert('Barbero Removido', 'El número ya no tiene acceso de barbero.');
      loadData();
    } catch (err: any) {
      showAlert('Error', err.message || 'No se pudo eliminar', 'error');
    }
  };

  const toggleStatus = async (org: any) => {
    const nextStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.patch(`/api/superadmin/organizations/${org.id}`, { status: nextStatus });
      showAlert(
        nextStatus === 'ACTIVE' ? 'Suscripción Activada' : 'Suscripción Pausada',
        nextStatus === 'ACTIVE'
          ? `La barbería ${org.name} ya está disponible nuevamente.`
          : `La barbería ${org.name} quedó pausada. Clientes y barberos verán el aviso de suspensión.`
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

      {/* HEADER */}
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

      {/* CUERPO */}
      <div style={{ maxWidth: 1280, margin: '28px auto 0', padding: '0 20px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span className="cal-eyebrow">ADMINISTRADOR GLOBAL</span>
            <h1 style={{ fontFamily: 'Sora', fontSize: 26, color: '#0b1020', marginTop: 2 }}>Control de Barberías y Logos</h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
              Sube fotos desde tu computadora, administra números de barberos con jerarquía y gestiona suscripciones.
            </p>
          </div>
          <button onClick={() => setCreateModal(true)} className="btn-clean-submit" style={{ width: 'auto', padding: '10px 22px' }}>
            <Plus size={16} style={{ display: 'inline', marginRight: 6 }} /> Registrar Nueva Barbería
          </button>
        </div>

        {/* MÉTRICAS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
          
          <div className="client-summary-card" style={{ padding: '18px 20px' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={15} color="#1554ff" /> Barberías Totales
            </span>
            <b style={{ fontSize: 28, fontFamily: 'Sora', color: '#0b1020', display: 'block', marginTop: 8 }}>
              {stats.totalOrganizations}
            </b>
          </div>

          <div className="client-summary-card" style={{ padding: '18px 20px' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={15} color="#16a34a" /> Suscripciones Activas
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
              <Scissors size={15} color="#0284c7" /> Barberos Activos
            </span>
            <b style={{ fontSize: 28, fontFamily: 'Sora', color: '#0284c7', display: 'block', marginTop: 8 }}>
              {stats.totalBarbers}
            </b>
          </div>

          <div className="client-summary-card" style={{ padding: '18px 20px' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarCheck2 size={15} color="#1554ff" /> Citas
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

        {/* TABLA DE BARBERÍAS */}
        <div className="table-card-saas">
          <div className="table-saas-header">
            <div>
              <span className="cal-eyebrow">PORTAFOLIO DE NEGOCIOS</span>
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
                  <th>Logo & Negocio</th>
                  <th>Enlace Público</th>
                  <th>Barberos</th>
                  <th>Citas</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Gestión</th>
                </tr>
              </thead>
              <tbody>
                {orgs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>
                      {loading ? 'Cargando barberías...' : 'No hay barberías registradas.'}
                    </td>
                  </tr>
                ) : (
                  orgs.map((o) => {
                    const isActive = o.status === 'ACTIVE';
                    const allowedCount = o.allowedBarbers?.length || o._count?.barbers || 0;

                    return (
                      <tr key={o.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {o.logoUrl ? (
                              <img
                                src={o.logoUrl}
                                alt={o.name}
                                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #e2e8f0' }}
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="client-avatar-circle" style={{ width: 44, height: 44, fontSize: 15 }}>
                                {o.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <b style={{ color: '#0b1020', fontSize: 15, display: 'block' }}>{o.name}</b>
                              <span style={{ fontSize: 11, color: '#64748b' }}>Slug: /b/{o.slug}</span>
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

                        <td>
                          <button
                            onClick={() => setBarbersModal({ open: true, org: o })}
                            className="btn-action-sm btn-unblock"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          >
                            <Scissors size={13} /> {allowedCount} Barbero(s) (Jerarquía)
                          </button>
                        </td>

                        <td style={{ fontWeight: 700, color: '#334155' }}>
                          {o._count?.appointments ?? 0}
                        </td>

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
                                  <PlayCircle size={13} style={{ display: 'inline', marginRight: 4 }} /> Reactivar
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

      {/* MODAL CREAR BARBERÍA CON SUBIDA DE ARCHIVO */}
      {createModal && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span className="cal-eyebrow">NUEVA BARBERÍA SAAS</span>
                <h3 style={{ fontFamily: 'Sora', fontSize: 19, marginTop: 2 }}>Registrar Barbería y Logo</h3>
              </div>
              <button onClick={() => setCreateModal(false)} className="btn-logout-modern" style={{ padding: '6px 10px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="input-group">
                <label className="input-label">Nombre del Negocio</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Barbería Roma"
                  className="clean-input"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]/g, '-'));
                  }}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Slug de Acceso (URL)</label>
                <input
                  type="text"
                  required
                  placeholder="roma"
                  className="clean-input"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
                <small style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 4 }}>
                  Link: <b>app.asysdigital.com/b/{slug || 'nombre-slug'}</b>
                </small>
              </div>

              {/* SELECTOR DE IMAGEN DESDE EL COMPUTADOR */}
              <div className="input-group">
                <label className="input-label">Foto / Logo de la Barbería</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Preview"
                      style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '2px solid #1554ff' }}
                    />
                  ) : (
                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#f1f5f9', border: '1.5px dashed #cbd5e1', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
                      <ImageIcon size={22} />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="btn-action-sm btn-unblock"
                    style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Upload size={14} /> {uploadingLogo ? 'Subiendo...' : logoUrl ? 'Cambiar Foto' : 'Cargar Imagen desde PC'}
                  </button>
                </div>
              </div>

              {/* LISTA DE BARBEROS Y JERARQUÍA */}
              <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 16, marginTop: 14, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <b style={{ fontSize: 13, color: '#0b1020' }}>Barberos Autorizados (WhatsApp y Jerarquía)</b>
                  <button
                    type="button"
                    onClick={() => setBarberList([...barberList, { name: '', phone: '', priority: barberList.length + 1 }])}
                    className="btn-action-sm btn-unblock"
                    style={{ fontSize: 11 }}
                  >
                    + Añadir Barbero
                  </button>
                </div>

                {barberList.map((b, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Nombre barbero"
                      className="clean-input"
                      style={{ padding: '8px 10px', fontSize: 13 }}
                      value={b.name}
                      onChange={(e) => {
                        const copy = [...barberList];
                        copy[idx].name = e.target.value;
                        setBarberList(copy);
                      }}
                    />
                    <input
                      type="tel"
                      placeholder="WhatsApp (300123...)"
                      className="clean-input"
                      style={{ padding: '8px 10px', fontSize: 13 }}
                      value={b.phone}
                      onChange={(e) => {
                        const copy = [...barberList];
                        copy[idx].phone = e.target.value;
                        setBarberList(copy);
                      }}
                    />
                    <select
                      value={b.priority}
                      onChange={(e) => {
                        const copy = [...barberList];
                        copy[idx].priority = Number(e.target.value);
                        setBarberList(copy);
                      }}
                      className="clean-input"
                      style={{ padding: '8px 6px', fontSize: 12 }}
                    >
                      <option value={1}>1º Prioridad</option>
                      <option value={2}>2º Prioridad</option>
                      <option value={3}>3º Prioridad</option>
                      <option value={4}>4º Prioridad</option>
                      <option value={5}>5º Prioridad</option>
                    </select>

                    {barberList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBarberList(barberList.filter((_, i) => i !== idx))}
                        className="btn-dark"
                        style={{ padding: '8px' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button type="submit" disabled={submitting || uploadingLogo} className="btn-clean-submit">
                {submitting ? 'Creando...' : 'Crear Barbería y Guardar →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR BARBERÍA (PERMITE CAMBIAR LOGO EN CUALQUIER MOMENTO) */}
      {editModal.open && editModal.org && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span className="cal-eyebrow">EDITAR BARBERÍA</span>
                <h3 style={{ fontFamily: 'Sora', fontSize: 19, marginTop: 2 }}>{editModal.org.name}</h3>
              </div>
              <button onClick={() => setEditModal({ open: false, org: null })} className="btn-logout-modern" style={{ padding: '6px 10px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdate}>
              <div className="input-group">
                <label className="input-label">Nombre del Negocio</label>
                <input
                  type="text"
                  required
                  className="clean-input"
                  value={editModal.org.name}
                  onChange={(e) => setEditModal({ ...editModal, org: { ...editModal.org, name: e.target.value } })}
                />
              </div>

              {/* CAMBIO DE LOGO DESDE ARCHIVO */}
              <div className="input-group">
                <label className="input-label">Foto / Logo</label>
                <input
                  type="file"
                  ref={editFileInputRef}
                  accept="image/*"
                  onChange={handleEditFileUpload}
                  style={{ display: 'none' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {editModal.org.logoUrl ? (
                    <img
                      src={editModal.org.logoUrl}
                      alt="Logo"
                      style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '2px solid #1554ff' }}
                    />
                  ) : (
                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#f1f5f9', border: '1.5px dashed #cbd5e1', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
                      <ImageIcon size={22} />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="btn-action-sm btn-unblock"
                    style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Upload size={14} /> {uploadingLogo ? 'Subiendo...' : 'Cambiar Imagen desde PC'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={submitting || uploadingLogo} className="btn-clean-submit" style={{ marginTop: 10 }}>
                {submitting ? 'Guardando...' : 'Guardar Cambios →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GESTIÓN DE BARBEROS */}
      {barbersModal.open && barbersModal.org && (
        <div className="modal-hours-overlay">
          <div className="modal-hours-box" style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span className="cal-eyebrow">BARBEROS DE {barbersModal.org.name.toUpperCase()}</span>
                <h3 style={{ fontFamily: 'Sora', fontSize: 19, marginTop: 2 }}>Lista Blanca y Jerarquía</h3>
              </div>
              <button onClick={() => setBarbersModal({ open: false, org: null })} className="btn-logout-modern" style={{ padding: '6px 10px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <b style={{ fontSize: 13, color: '#0b1020', display: 'block', marginBottom: 8 }}>Barberos Habilitados:</b>
              {(!barbersModal.org.allowedBarbers || barbersModal.org.allowedBarbers.length === 0) ? (
                <div style={{ padding: 16, background: '#f8fafc', borderRadius: 12, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                  No hay números autorizados todavía.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {barbersModal.org.allowedBarbers.map((ab: any) => (
                    <div key={ab.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div>
                        <b style={{ fontSize: 14, color: '#0b1020' }}>{ab.name}</b>
                        <span style={{ fontSize: 12, color: '#64748b', display: 'block' }}>
                          📱 {ab.phone} · <span style={{ color: '#1554ff', fontWeight: 800 }}>Prioridad #{ab.priority}</span> {ab.claimed ? '· (Registrado ✓)' : '· (Pendiente)'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveAllowedBarber(ab.id)}
                        className="btn-action-sm btn-cancel"
                        style={{ padding: '6px 10px' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleAddBarberToOrg} style={{ background: '#eff6ff', padding: 16, borderRadius: 14, border: '1px solid #bfdbfe' }}>
              <b style={{ fontSize: 13, color: '#1e3a8a', display: 'block', marginBottom: 8 }}>Autorizar Nuevo Celular:</b>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  required
                  placeholder="Nombre barbero"
                  className="clean-input"
                  style={{ padding: '8px 10px', fontSize: 13 }}
                  value={newBName}
                  onChange={(e) => setNewBName(e.target.value)}
                />
                <input
                  type="tel"
                  required
                  placeholder="WhatsApp"
                  className="clean-input"
                  style={{ padding: '8px 10px', fontSize: 13 }}
                  value={newBPhone}
                  onChange={(e) => setNewBPhone(e.target.value)}
                />
                <select
                  value={newBPriority}
                  onChange={(e) => setNewBPriority(Number(e.target.value))}
                  className="clean-input"
                  style={{ padding: '8px 6px', fontSize: 12 }}
                >
                  <option value={1}>1º Prioridad</option>
                  <option value={2}>2º Prioridad</option>
                  <option value={3}>3º Prioridad</option>
                  <option value={4}>4º Prioridad</option>
                  <option value={5}>5º Prioridad</option>
                </select>
              </div>

              <button type="submit" disabled={submitting} className="btn-clean-submit" style={{ padding: '10px' }}>
                {submitting ? 'Autorizando...' : '+ Autorizar Barbero'}
              </button>
            </form>

          </div>
        </div>
      )}

      {/* MODAL ALERTA */}
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