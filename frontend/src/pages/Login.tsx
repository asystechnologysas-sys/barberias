import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Campos
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (tab === 'login') {
        const res = await api.post('/api/auth/login', { email, password });
        localStorage.setItem('asys_token', res.token);
        localStorage.setItem('asys_user', JSON.stringify(res.user));

        // Redirección segura según el rol del usuario en PostgreSQL
        if (res.user.role === 'SUPERADMIN') {
          navigate('/superadmin');
        } else if (res.user.role === 'OWNER' || res.user.role === 'BARBER') {
          navigate('/admin');
        } else {
          // Cliente: se dirige a la barbería asignada o la principal
          navigate('/b/asysbarber');
        }
      } else {
        // Registro de nuevo cliente
        const res = await api.post('/api/auth/register', {
          slug: 'asysbarber',
          name,
          phone,
          password,
          code: '000000' // Código por defecto o validado por OTP
        });
        localStorage.setItem('asys_token', res.token);
        navigate('/b/asysbarber');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al autenticar. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="asys-auth-container">
      
      {/* LADO IZQUIERDO: Escenario 3D de ASYS Technology */}
      <div className="auth-stage-side">
        <div className="auth-aura-glow"></div>
        <div className="auth-grid-pattern"></div>

        {/* Marca Superior */}
        <div className="auth-stage-content">
          <div className="stage-eyebrow">ASYS TECHNOLOGY S.A.S.</div>
          <h1 className="auth-stage-title">
            Plataforma Inteligente de Agendamiento <span className="text-gradient-neon">Multi-Barbería</span>
          </h1>
          <p className="auth-stage-desc">
            Gestiona citas en tiempo real, fideliza clientes VIP y administra tu negocio con tecnología de alto impacto.
          </p>

          <div className="stage-pill-row">
            <span className="stage-pill">⚡ Tiempo Real</span>
            <span className="stage-pill">🛡️ Cero Doble Reserva</span>
            <span className="stage-pill">☁️ 100% Nube</span>
          </div>
        </div>

        {/* Núcleo Orbital 3D */}
        <div className="stage-3d-wrapper">
          <div className="stage-orbit"></div>
          <div className="stage-orbit-inner"></div>
          <div className="stage-core-logo">
            <img src="/asys-logo.png" alt="Logo ASYS" />
          </div>
        </div>

        {/* Pie del escenario */}
        <div style={{ position: 'relative', zIndex: 2, color: 'var(--text-dim)', fontSize: 12 }}>
          © 2026 ASYS Technology · Arquitectura Multi-Tenant Segura
        </div>
      </div>

      {/* LADO DERECHO: Formulario de Autenticación */}
      <div className="auth-form-side">
        <div className="auth-card-panel">
          
          {/* Logo y Nombre ASYS Barber */}
          <div className="auth-brand-header">
            <img src="/asys-logo.png" alt="ASYS Barber" className="auth-brand-logo" />
            <div className="auth-brand-titles">
              <b>ASYS BARBER</b>
              <span>GESTIÓN INTELIGENTE</span>
            </div>
          </div>

          {/* Selector de Pestañas */}
          <div className="auth-nav-tabs">
            <button
              type="button"
              className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => { setTab('login'); setErrorMsg(''); }}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => { setTab('register'); setErrorMsg(''); }}
            >
              Registrarse
            </button>
          </div>

          {/* Mensaje de error dinámico */}
          {errorMsg && (
            <div className="auth-error-banner">
              {errorMsg}
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit}>
            {tab === 'register' && (
              <>
                <div className="auth-field-group">
                  <label className="auth-label">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Andrés Martínez"
                    className="auth-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="auth-field-group">
                  <label className="auth-label">Teléfono WhatsApp</label>
                  <input
                    type="tel"
                    required
                    placeholder="+57 300 123 4567"
                    className="auth-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="auth-field-group">
              <label className="auth-label">Correo Electrónico</label>
              <input
                type="email"
                required
                placeholder="usuario@ejemplo.com"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="auth-field-group">
              <label className="auth-label">Contraseña</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-auth-submit">
              {loading ? 'Validando credenciales...' : tab === 'login' ? 'Ingresar a la Plataforma →' : 'Crear Cuenta →'}
            </button>
          </form>

          {/* Nota de Acceso Seguro */}
          <div className="auth-note-box">
            <b>Acceso Corporativo & Barberías</b>
            Para acceder como administrador general (Superadmin) o dueño de barbería, utiliza las credenciales asignadas por ASYS.
          </div>

        </div>
      </div>

    </div>
  );
}