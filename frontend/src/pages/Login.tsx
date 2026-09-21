import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { MessageSquare, CheckCircle2, ShieldCheck, Sparkles, KeyRound, ArrowLeft } from 'lucide-react';
import { api } from '../api';
import logoAsys from './logoAsys.png';

export default function Login() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  
  // Modos: 'login' | 'register' | 'forgot'
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');
  
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loginUser, setLoginUser] = useState('');

  // Campos para recuperación de contraseña
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtpCode, setForgotOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1); // 1 = pedir cel, 2 = código y nueva clave
  
  // Consentimiento legal obligatorio en Colombia
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Temporizadores
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

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Enviar código para REGISTRO
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

  // Enviar código para RECUPERAR CONTRASEÑA
  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!forgotPhone || forgotPhone.replace(/[^0-9]/g, '').length < 7) {
      setErrorMsg('Por favor ingresa tu número de WhatsApp registrado.');
      return;
    }

    const targetSlug = slug || 'asysbarber';
    setSendingOtp(true);
    try {
      await api.post('/api/auth/forgot-password', {
        slug: targetSlug,
        phone: forgotPhone
      });
      setForgotStep(2);
      setCountdown(60);
      setSuccessMsg('¡Código de recuperación enviado a tu WhatsApp!');
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo enviar el código');
    } finally {
      setSendingOtp(false);
    }
  };

  // Confirmar restablecimiento de contraseña
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!forgotOtpCode || forgotOtpCode.length < 4) {
      setErrorMsg('Por favor ingresa el código que recibiste por WhatsApp.');
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setErrorMsg('La nueva contraseña debe tener mínimo 4 caracteres.');
      return;
    }

    const targetSlug = slug || 'asysbarber';
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        slug: targetSlug,
        phone: forgotPhone,
        code: forgotOtpCode,
        newPassword
      });
      setSuccessMsg('¡Contraseña actualizada con éxito! Ya puedes iniciar sesión.');
      setTab('login');
      setForgotStep(1);
      setLoginUser(forgotPhone);
      setForgotPhone('');
      setForgotOtpCode('');
      setNewPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (tab === 'register' && !acceptedTerms) {
      setErrorMsg('Debes aceptar los Términos y la Política de Privacidad para crear tu cuenta.');
      return;
    }

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
      } else if (tab === 'register') {
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

          {/* PESTAÑAS (SE OCULTAN SI ESTAMOS EN MODO RECUPERACIÓN) */}
          {tab !== 'forgot' ? (
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
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg(''); setForgotStep(1); }}
                className="btn-logout-modern"
                style={{ padding: '6px 10px' }}
              >
                <ArrowLeft size={14} /> Volver
              </button>
              <b style={{ fontFamily: 'Sora', fontSize: 16, color: '#0b1020' }}>Recuperar Contraseña</b>
            </div>
          )}

          {errorMsg && <div className="clean-error-banner">{errorMsg}</div>}
          {successMsg && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontWeight: 700 }}>
              {successMsg}
            </div>
          )}

          {/* MODO 1: RECUPERACIÓN DE CONTRASEÑA */}
          {tab === 'forgot' ? (
            forgotStep === 1 ? (
              <form onSubmit={handleSendForgotOtp}>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
                  Ingresa tu número de celular registrado. Te enviaremos un código de seguridad a tu WhatsApp para restablecer tu clave.
                </p>

                <div className="input-group">
                  <label className="input-label">Celular WhatsApp</label>
                  <input
                    type="tel"
                    required
                    placeholder="3001234567"
                    className="clean-input"
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                  />
                </div>

                <button type="submit" disabled={sendingOtp} className="btn-clean-submit" style={{ marginTop: 8 }}>
                  {sendingOtp ? 'Enviando a tu WhatsApp...' : 'Enviar Código de Seguridad →'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
                  Revisa tu WhatsApp ({forgotPhone}) e ingresa el código recibido junto con tu nueva contraseña.
                </p>

                <div className="input-group">
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={14} color="#1554ff" /> Código de 6 dígitos
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="Ej. 492018"
                    className="clean-input"
                    style={{ letterSpacing: '0.2em', fontWeight: 800, fontSize: 16, textAlign: 'center' }}
                    value={forgotOtpCode}
                    onChange={(e) => setForgotOtpCode(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <KeyRound size={14} color="#1554ff" /> Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 4 caracteres"
                    className="clean-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-clean-submit" style={{ marginTop: 8 }}>
                  {loading ? 'Actualizando clave...' : 'Guardar Nueva Contraseña →'}
                </button>
              </form>
            )
          ) : (
            /* MODO 2: INICIAR SESIÓN O REGISTRARSE */
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

                  {/* CHECKBOX DE ACEPTACIÓN LEGAL */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '14px 0 16px 2px' }}>
                    <input
                      type="checkbox"
                      id="legalCheckbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      style={{ marginTop: 3, cursor: 'pointer', accentColor: '#1554ff', width: 16, height: 16 }}
                    />
                    <label htmlFor="legalCheckbox" style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4, cursor: 'pointer' }}>
                      He leído y acepto los{' '}
                      <Link to="/terminos" target="_blank" style={{ color: '#1554ff', fontWeight: 700, textDecoration: 'underline' }}>
                        Términos de Servicio
                      </Link>{' '}
                      y la{' '}
                      <Link to="/privacidad" target="_blank" style={{ color: '#1554ff', fontWeight: 700, textDecoration: 'underline' }}>
                        Política de Tratamiento de Datos
                      </Link>{' '}
                      de ASYS TECHNOLOGIES S.A.S.
                    </label>
                  </div>

                  <button type="submit" disabled={loading || !acceptedTerms} className="btn-clean-submit">
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label className="input-label" style={{ margin: 0 }}>Contraseña</label>
                      <button
                        type="button"
                        onClick={() => { setTab('forgot'); setErrorMsg(''); setSuccessMsg(''); setForgotStep(1); }}
                        style={{ background: 'none', border: 'none', color: '#1554ff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
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
          )}

          <div className="clean-note-box">
            <b>Verificación Segura WhatsApp</b>
            {tenantInfo
              ? `Estás en ${tenantInfo.name}. Tu cuenta está protegida mediante verificación de doble factor.`
              : 'Clientes, barberos y dueños acceden según los permisos de su cuenta.'}
          </div>
        </div>
      </div>
    </div>
  );
}