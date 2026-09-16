import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import logoAsys from './logoAsys.png';

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginUser, setLoginUser] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    // Limpieza obligatoria antes de crear o iniciar sesión
    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');

    try {
      if (tab === 'login') {
        const res = await api.post('/api/auth/login', {
          email: loginUser,
          password
        });
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
          password
        });
        localStorage.setItem('asys_token', res.token);
        localStorage.setItem('asys_user', JSON.stringify(res.user));
        navigate('/b/asysbarber');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error en autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split-container">
      <div className="login-visual-side">
        <div className="badge-brand-chip">⚡ ASYS BARBER SOFTWARE</div>
        <div className="login-visual-content">
          <h1 className="login-visual-title">Estilo moderno, agenda sin vueltas.</h1>
          <p className="login-visual-desc">
            Gestiona citas, turnos y clientes en tiempo real. La experiencia digital diseñada para barberías que valoran su tiempo.
          </p>
          <div className="pill-features-row">
            <span className="pill-feature">✂️ Citas en vivo</span>
            <span className="pill-feature">📱 Notificaciones WhatsApp</span>
            <span className="pill-feature">⭐ Clientes VIP</span>
          </div>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card-floating">
          <div className="app-brand-header">
            <img src={logoAsys} alt="ASYS Barber" className="app-brand-avatar" />
            <div className="app-brand-titles">
              <b>ASYS BARBER</b>
              <span>SOFTWARE DE GESTIÓN</span>
            </div>
          </div>

          <div className="clean-tabs-nav">
            <button
              type="button"
              className={`clean-tab-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => { setTab('login'); setErrorMsg(''); }}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              className={`clean-tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => { setTab('register'); setErrorMsg(''); }}
            >
              Registrarse
            </button>
          </div>

          {errorMsg && <div className="clean-error-banner">{errorMsg}</div>}

          <form onSubmit={handleSubmit}>
            {tab === 'register' ? (
              <>
                <div className="input-group">
                  <label className="input-label">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Tu nombre y apellido"
                    className="clean-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Número de Celular (WhatsApp)</label>
                  <input
                    type="tel"
                    required
                    placeholder="3001234567"
                    className="clean-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Crea una Contraseña</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 4 caracteres"
                    className="clean-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-clean-submit">
                  {loading ? 'Creando cuenta...' : 'Crear Cuenta y Agendar →'}
                </button>
              </>
            ) : (
              <>
                <div className="input-group">
                  <label className="input-label">Celular o Correo</label>
                  <input
                    type="text"
                    required
                    placeholder="3001234567 o correo@ejemplo.com"
                    className="clean-input"
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Contraseña</label>
                  <input
                    type="password"
                    required
                    placeholder="Tu contraseña"
                    className="clean-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-clean-submit">
                  {loading ? 'Ingresando...' : 'Iniciar Sesión →'}
                </button>
              </>
            )}
          </form>

          <div className="clean-note-box">
            <b>Acceso a la plataforma</b>
            Clientes, barberos y dueños acceden según los permisos de su cuenta.
          </div>
        </div>
      </div>
    </div>
  );
}