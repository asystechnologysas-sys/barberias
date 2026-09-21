import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react';

export function TerminosPage() {
  return (
    <div style={{ maxWidth: 840, margin: '40px auto', padding: '0 20px', fontFamily: 'Manrope, sans-serif', color: '#0b1020', lineHeight: 1.7 }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1554ff', textDecoration: 'none', fontWeight: 700, marginBottom: 24 }}>
        <ArrowLeft size={16} /> Volver al Inicio
      </Link>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <FileText size={32} color="#1554ff" />
        <h1 style={{ fontFamily: 'Sora', fontSize: 26 }}>Términos y Condiciones de Uso</h1>
      </div>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>Última actualización: Septiembre de 2026 · ASYS TECHNOLOGIES S.A.S.</p>

      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '28px 24px' }}>
        <h3 style={{ fontFamily: 'Sora', marginBottom: 8 }}>1. Identificación del Servicio</h3>
        <p style={{ fontSize: 14, color: '#475569', marginBottom: 18 }}>
          ASYS Barber es una solución tecnológica desarrollada y operada por ASYS TECHNOLOGIES S.A.S., destinada a facilitar el agendamiento digital, asignación de turnos y fidelización para barberías y sus clientes finales.
        </p>

        <h3 style={{ fontFamily: 'Sora', marginBottom: 8 }}>2. Naturaleza del Agendamiento</h3>
        <p style={{ fontSize: 14, color: '#475569', marginBottom: 18 }}>
          La reserva de un turno a través de la plataforma constituye un acuerdo de servicio directo entre el cliente y el establecimiento de barbería respectivo. ASYS actúa como facilitador tecnológico y no asume responsabilidad directa por la prestación del corte, servicio estético, retrasos o cancelaciones imputables a los profesionales del local.
        </p>

        <h3 style={{ fontFamily: 'Sora', marginBottom: 8 }}>3. Verificación de Identidad mediante WhatsApp</h3>
        <p style={{ fontSize: 14, color: '#475569', marginBottom: 18 }}>
          Para garantizar la legitimidad de las reservas y evitar suplantaciones o reservas falsas, el usuario consiente el envío de códigos de seguridad de un solo uso (OTP) a su número de WhatsApp.
        </p>

        <h3 style={{ fontFamily: 'Sora', marginBottom: 8 }}>4. Suspensión de Servicio</h3>
        <p style={{ fontSize: 14, color: '#475569', marginBottom: 18 }}>
          ASYS se reserva la potestad de suspender temporal o definitivamente cuentas de usuario que hagan uso abusivo de la plataforma o incurran en cancelaciones reiteradas injustificadas. Asimismo, los paneles de barberías que presenten mora en su suscripción quedarán inhabilitados hasta su regularización.
        </p>
      </div>
    </div>
  );
}

export function PrivacidadPage() {
  return (
    <div style={{ maxWidth: 840, margin: '40px auto', padding: '0 20px', fontFamily: 'Manrope, sans-serif', color: '#0b1020', lineHeight: 1.7 }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1554ff', textDecoration: 'none', fontWeight: 700, marginBottom: 24 }}>
        <ArrowLeft size={16} /> Volver al Inicio
      </Link>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <ShieldCheck size={32} color="#16a34a" />
        <h1 style={{ fontFamily: 'Sora', fontSize: 26 }}>Política de Tratamiento de Datos (Habeas Data)</h1>
      </div>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>Conforme a la Ley 1581 de 2012 · ASYS TECHNOLOGIES S.A.S.</p>

      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '28px 24px' }}>
        <h3 style={{ fontFamily: 'Sora', marginBottom: 8 }}>1. Finalidad de la Recolección</h3>
        <p style={{ fontSize: 14, color: '#475569', marginBottom: 18 }}>
          Los datos personales solicitados (nombre completo y celular WhatsApp) tienen por única finalidad: autenticar tu registro mediante código OTP, confirmar tus citas de barbería, enviar recordatorios transaccionales y gestionar membresías VIP.
        </p>

        <h3 style={{ fontFamily: 'Sora', marginBottom: 8 }}>2. No Comercialización</h3>
        <p style={{ fontSize: 14, color: '#475569', marginBottom: 18 }}>
          ASYS TECHNOLOGIES S.A.S. no vende, no arrienda ni transfiere bases de datos a terceros con fines publicitarios ajenos a la operación de la cita solicitada.
        </p>

        <h3 style={{ fontFamily: 'Sora', marginBottom: 8 }}>3. Derechos del Titular (Habeas Data)</h3>
        <p style={{ fontSize: 14, color: '#475569', marginBottom: 18 }}>
          En cualquier momento puedes ejercer tus derechos de conocer, actualizar, rectificar o solicitar la supresión de tus datos de nuestros sistemas remitiendo una comunicación formal al correo <b>privacidad@asysdigital.com</b>.
        </p>
      </div>
    </div>
  );
}