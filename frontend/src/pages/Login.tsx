import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../api';
import logoAsys from './logoAsys.png';

export default function Login() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loginUser, setLoginUser] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estado para el envío de código WhatsApp
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (slug) {
      api.get(`/api/public/${slug}`)
        .then((data) => setTenantInfo(data))
        .catch(() => setTenantInfo(null));
    }
  }, [slug]);

  // Temporizador para reenvío de código
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOtp = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!phone || phone.replace(/[^0-9]/g, '').length < 7) {
      setErrorMsg('Por favor ingresa un número de celular válido.');
      return;
    }

    const targetSlug = slug || 'asysbarber';
    setSendingOtp(true);
    try {
      await api.post('/api/auth/send-otp', {
        slug: targetSlug,
        phone
      });
      setOtpSent(true);
      setCountdown(60);
      setSuccessMsg('¡Código enviado a tu WhatsApp! Revisa tus mensajes.');
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo enviar el código por WhatsApp');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    localStorage.removeItem('asys_token');
    localStorage.removeItem('asys_user');

    try {
      if (tab === 'login') {
        const res = await api.post('/api/auth/login', {
          email: loginUser,
          password,
          slug: slug || undefined
        });
        localStorage.setItem('asys_token', res.token);
        localStorage.setItem('asys_user', JSON.stringify(res.user));

        if (res.user.role === 'SUPERADMIN') {
          navigate('/superadmin');
        } else if (res.user.role === 'OWNER' || res.user.role === 'BARBER') {
          navigate('/admin');
        } else {
          const targetSlug = res.user.organizationSlug || slug || 'asysbarber';
          navigate(`/b/${targetSlug}`);
        }
      } else {
        if (!otpCode) {
          throw new Error('Por favor ingresa el código que te enviamos por WhatsApp.');
        }

        const targetSlug = slug || 'asysbarber';
        const res = await api.post('/api/auth/register', {
          slug: targetSlug,
          name,
          phone,
          password,
          code: otpCode
        });
        localStorage.setItem('asys_token', res.token);
        localStorage.setItem('asys_user', JSON.stringify(res.user));

        if (res.user.role === 'BARBER') {
          navigate('/admin');
        } else {
          navigate(`/b/${targetSlug}`);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error en autenticación');
    } finally {
      setLoading(false);
    }
  };

  const brandName = tenantInfo?.name || 'ASYS BARBER';
  const brandLogo = tenantInfo?.logoUrl || logoAsys;

  return (
    <div className="login-split-container">
      <div className="login-visual-side">
        <div className="badge-brand-chip">⚡ {brandName.toUpperCase()} · GESTIÓN DIGITAL</div>
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
            <img src={brandLogo} alt={brandName} className="app-brand-avatar" />
            <div className="app-brand-titles">
              <b>{brandName}</b>
              <span>{tenantInfo ? 'PORTAL OFICIAL DE CLIENTES' : 'SOFTWARE DE GESTIÓN'}</span>
            </div>
          </div>

          <div className="clean-tabs-nav">
            <button
              type="button"
              className={`clean-tab-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg(''); }}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              className={`clean-tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => { setTab('register'); setErrorMsg(''); setSuccessMsg(''); }}
            >
              Registrarse
            </button>
          </div>

          {errorMsg && <div className="clean-error-banner">{errorMsg}</div>}
          {successMsg && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontWeight: 700 }}>
              {successMsg}
            </div>
          )}

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

                {/* CELULAR + BOTÓN ENVIAR WHATSAPP */}
                <div className="input-group">
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageSquare size={13} color="#25d366" /> Celular WhatsApp (Colombia)
                  </label>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="tel"
                      required
                      placeholder="3001234567"
                      className="clean-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={sendingOtp || countdown > 0}
                      onClick={handleSendOtp}
                      className="btn-clean-submit"
                      style={{
                        width: 'auto',
                        padding: '0 14px',
                        fontSize: 12,
                        marginTop: 0,
                        whiteSpace: 'nowrap',
                        background: otpSent ? '#16a34a' : '#25d366'
                      }}
                    >
                      {sendingOtp ? 'Enviando...' : countdown > 0 ? `${countdown}s` : otpSent ? 'Reenviar' : 'Enviar Código'}
                    </button>
                  </div>
                  <small style={{ fontSize: 11, color: '#64748b', display: 'block', marginTop: 4 }}>
                    Te enviaremos un código de seguridad a tu WhatsApp.
                  </small>
                </div>

                {/* CÓDIGO DE WHATSAPP */}
                <div className="input-group">
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={14} color="#1554ff" /> Código de 6 dígitos de WhatsApp
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="Ej. 583921"
                    className="clean-input"
                    style={{ letterSpacing: '0.2em', fontWeight: 800, fontSize: 16, textAlign: 'center' }}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
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
                  {loading ? 'Validando y Creando...' : 'Verificar WhatsApp y Registrarse →'}
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
            <b>Verificación Segura WhatsApp</b>
            {tenantInfo
              ? `Estás ingresando a ${tenantInfo.name}. Tu agenda quedará vinculada a esta barbería.`
              : 'Clientes, barberos y dueños acceden según los permisos de su cuenta.'}
          </div>
        </div>
      </div>
    </div>
  );
}