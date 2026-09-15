import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, X, ExternalLink, LogOut, Check, PauseCircle } from 'lucide-react';
import { api } from '../api';

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>({ totalOrganizations: 0, active: 0, suspended: 0, expiringSoon: 0, totalBarbers: 0, totalAppointments: 0 });
  const [orgs, setOrgs] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const s = await api.get('/api/superadmin/stats');
      setStats(s);
      const o = await api.get('/api/superadmin/organizations');
      setOrgs(o);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateBarberia = async (e: React.FormEvent) => {
    e.preventDefault();
    // Limpieza estricta del slug: quitar '/b/', espacios y símbolos
    const cleanSlug = slug.toLowerCase().replace('/b/', '').trim().replace(/[^a-z0-9-]/g, '-');
    if (!name || !cleanSlug) return alert('Por favor ingresa nombre y slug válido.');

    setLoading(true);
    try {
      await api.post('/api/superadmin/organizations', {
        name,
        slug: cleanSlug,
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        maxBarbers: 5
      });
      alert(`¡Barbería ${name} creada exitosamente!`);
      setShowModal(false);
      setName('');
      setSlug('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al crear barbería');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (orgId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.patch(`/api/superadmin/organizations/${orgId}`, { status: nextStatus });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado');
    }
  };

  return (
    <div>
      <header className="top-nav">
        <div className="brand-badge">
          <div className="brand-logo-sq" style={{ color: 'var(--primary-blue)' }}>A</div>
          <div>
            <b style={{ fontSize: 16 }}>ASYS CONTROL</b>
            <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>ADMINISTRACIÓN CENTRAL MULTI-TENANT</small>
          </div>
        </div>
        <button onClick={() => { localStorage.removeItem('asys_token'); navigate('/login'); }} className="btn-dark">
          <LogOut size={15} /> Salir
        </button>
      </header>

      <div style={{ maxWidth: 1300, margin: '30px auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <div className="cal-label">SUPERADMIN DASHBOARD</div>
            <h1 style={{ fontFamily: 'Outfit', fontSize: 38 }}>Control de Barberías</h1>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-gold">
            <Plus size={16} /> Crear Nueva Barbería
          </button>
        </div>

        {/* Estadísticas de la plataforma */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 35 }}>
          <div className="summary-card">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Barberías</span>
            <b style={{ fontSize: 28, display: 'block', marginTop: 6 }}>{stats.totalOrganizations}</b>
          </div>
          <div className="summary-card">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Activas</span>
            <b style={{ fontSize: 28, display: 'block', marginTop: 6, color: 'var(--accent-green)' }}>{stats.active}</b>
          </div>
          <div className="summary-card">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pausadas</span>
            <b style={{ fontSize: 28, display: 'block', marginTop: 6, color: 'var(--accent-red)' }}>{stats.suspended}</b>
          </div>
          <div className="summary-card">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Por Vencer</span>
            <b style={{ fontSize: 28, display: 'block', marginTop: 6 }}>{stats.expiringSoon}</b>
          </div>
          <div className="summary-card">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Barberos</span>
            <b style={{ fontSize: 28, display: 'block', marginTop: 6 }}>{stats.totalBarbers}</b>
          </div>
          <div className="summary-card">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Citas</span>
            <b style={{ fontSize: 28, display: 'block', marginTop: 6 }}>{stats.totalAppointments}</b>
          </div>
        </div>

        {/* Listado dinámico de barberías */}
        <div className="cal-label">LISTADO Y GESTIÓN DE NEGOCIOS</div>
        <table className="super-table">
          <thead>
            <tr>
              <th>Negocio</th>
              <th>Enlace Público</th>
              <th>Barberos</th>
              <th>Meses Activa</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>Cargando barberías registradas...</td></tr>
            ) : (
              orgs.map(o => {
                const created = new Date(o.createdAt || '2026-09-01');
                const diffMonths = Math.max(1, Math.floor((Date.now() - created.getTime()) / (1000 * 3600 * 24 * 30)));

                return (
                  <tr key={o.id}>
                    <td><b>{o.name}</b></td>
                    <td>
                      <Link to={`/b/${o.slug}`} target="_blank" style={{ color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        /b/{o.slug} <ExternalLink size={12} />
                      </Link>
                    </td>
                    <td>{o._count?.barbers ?? o.maxBarbers}</td>
                    <td><b>{diffMonths} mes(es)</b></td>
                    <td>{new Date(o.subscriptionExpiresAt).toLocaleDateString()}</td>
                    <td>
                      <span style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: o.status === 'ACTIVE' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: o.status === 'ACTIVE' ? '#34d399' : '#f87171'
                      }}>
                        {o.status === 'ACTIVE' ? 'ACTIVA' : 'PAUSADA'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleStatus(o.id, o.status)}
                        className={o.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}
                      >
                        {o.status === 'ACTIVE' ? 'Pausar Suscripción' : 'Reactivar'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear Barbería */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18 }}>Registrar Nueva Barbería</h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowModal(false)} />
            </div>

            <form onSubmit={handleCreateBarberia}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nombre del Negocio:</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Barbería Élite" required />

              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Slug / URL del enlace:</label>
              <input
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="elite (sin barras /b/)"
                required
              />
              <small style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', marginTop: -8, marginBottom: 12 }}>
                Quedará en: app.asysdigital.com/b/{slug.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'tu-barberia'}
              </small>

              <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%', marginTop: 10 }}>
                {loading ? 'Creando...' : 'Crear Barbería'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}