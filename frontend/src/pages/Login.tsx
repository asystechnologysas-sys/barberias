import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('admin@asys.local');
  const [password, setPassword] = useState('AsysDemo2026!');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === 'login') {
        const res = await api.post('/api/auth/login', { email, password });
        localStorage.setItem('asys_token', res.token);
        localStorage.setItem('asys_user', JSON.stringify(res.user));

        if (res.user.role === 'SUPERADMIN') navigate('/superadmin');
        else if (res.user.role === 'OWNER' || res.user.role === 'BARBER') navigate('/admin');
        else navigate('/b/asysbarber');
      } else {
        const res = await api.post('/api/auth/register', {
          slug: 'asysbarber',
          name,
          phone,
          password,
          code: '000000'
        });
        localStorage.setItem('asys_token', res.token);
        navigate('/b/asysbarber');
      }
    } catch (err: any) {
      alert(err.message || 'Error en autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="split-auth-layout">
      <div className="split-hero-side">
        <div className="split-hero-content">
          <div className="cal-label">JMBARBER</div>
          <h1>Estilo moderno, agenda sin vueltas.</h1>
          <p style={{ color: '#cbd5e1', fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
            Reserva cortes, entra como cliente o administra las citas del estudio desde un panel claro y elegante.
          </p>
          <div>
            <span className="pill-tag">Corte $25k</span>
            <span className="pill-tag">8am - 8pm</span>
            <span className="pill-tag">Agenda online</span>
          </div>
        </div>
      </div>

      <div className="split-form-side">
        <div style={{ maxWidth: 380, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div className="brand-logo-sq">JM</div>
            <div>
              <b style={{ fontSize: 16 }}>JMbarber</b>
              <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12 }}>Acceso de clientes y barbero</small>
            </div>
          </div>

          <div className="auth-tabs">
            <div className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
              Entrar
            </div>
            <div className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
              Registrarse
            </div>
          </div>

          <form onSubmit={handleAuth}>
            {tab === 'register' && (
              <>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nombre completo</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  style={{ width: '100%', background: '#131b29', border: '1px solid var(--border)', color: 'white', padding: 12, borderRadius: 8, margin: '6px 0 14px' }}
                />
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Número de celular</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+573001234567"
                  required
                  style={{ width: '100%', background: '#131b29', border: '1px solid var(--border)', color: 'white', padding: 12, borderRadius: 8, margin: '6px 0 14px' }}
                />
              </>
            )}

            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
              style={{ width: '100%', background: '#131b29', border: '1px solid var(--border)', color: 'white', padding: 12, borderRadius: 8, margin: '6px 0 14px' }}
            />

            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              required
              style={{ width: '100%', background: '#131b29', border: '1px solid var(--border)', color: 'white', padding: 12, borderRadius: 8, margin: '6px 0 20px' }}
            />

            <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%' }}>
              {loading ? 'Procesando...' : tab === 'login' ? 'Iniciar Sesión' : 'Crear cuenta y agendar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}