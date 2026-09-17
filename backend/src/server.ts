import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role, AppointmentStatus, OrganizationStatus, VipExceptionType, VipFrequency } from '@prisma/client';
import { z } from 'zod';

const db = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_long_enough_2026';

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60_000, max: 1000, standardHeaders: true, legacyHeaders: false }));

type Auth = { id: string; role: Role; organizationId: string | null };
declare global { namespace Express { interface Request { auth?: Auth } } }

const fail = (res: Response, status: number, code: string, message: string) => res.status(status).json({ success: false, error: { code, message } });
const asyncRoute = (fn: (r: Request, s: Response, n: NextFunction) => Promise<unknown>) => (r: Request, s: Response, n: NextFunction) => void fn(r, s, n).catch(n);

function tokenFor(user: { id: string; role: Role; organizationId: string | null }) {
  return jwt.sign({ sub: user.id, role: user.role, organizationId: user.organizationId }, JWT_SECRET, { expiresIn: '8h' });
}

function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, '') || req.cookies.access_token;
  if (!token) return fail(res, 401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  try {
    const p = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    req.auth = { id: p.sub!, role: p.role, organizationId: p.organizationId || null };
    next();
  } catch {
    return fail(res, 401, 'INVALID_TOKEN', 'La sesión no es válida o expiró.');
  }
}

function role(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) =>
    !req.auth || !roles.includes(req.auth.role) ? fail(res, 403, 'FORBIDDEN', 'No tienes permisos para esta acción.') : next();
}

async function activeTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.organizationId) return fail(res, 403, 'TENANT_REQUIRED', 'Esta acción requiere una barbería.');
  const o = await db.organization.findUnique({ where: { id: req.auth.organizationId } });
  if (!o || o.status !== OrganizationStatus.ACTIVE || o.subscriptionExpiresAt <= new Date()) {
    return fail(res, 403, 'ORGANIZATION_SUSPENDED', 'Esta barbería no está disponible temporalmente.');
  }
  next();
}

const toBogotaHour = (date: Date) => {
  return date.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false });
};

// 1. HEALTH & PUBLIC TENANT
app.get('/api/health', asyncRoute(async (_q, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
}));

app.get('/api/public/:slug', asyncRoute(async (req, res) => {
  const now = new Date();
  const next8Days = new Date(now.getTime() + 9 * 24 * 3600 * 1000);

  const org = await db.organization.findUnique({
    where: { slug: String(req.params.slug) },
    include: {
      services: { where: { active: true } },
      barbers: { where: { active: true }, select: { id: true, displayName: true } },
      schedules: true,
      blockedSlots: true,
      appointments: {
        where: {
          status: AppointmentStatus.CONFIRMED,
          startsAt: { gte: new Date(now.toISOString().split('T')[0] + 'T00:00:00-05:00'), lte: next8Days }
        },
        select: { startsAt: true, endsAt: true, barberId: true }
      },
      vipSchedules: {
        where: { active: true },
        include: { exceptions: true }
      }
    }
  });

  if (!org) return fail(res, 404, 'ORGANIZATION_NOT_FOUND', 'Barbería no encontrada.');
  res.json({ success: true, data: org });
}));

// DISPONIBILIDAD REAL BASADA EN LOS HORARIOS CONFIGURADOS POR EL BARBERO
app.get('/api/public/:slug/availability', asyncRoute(async (req, res) => {
  const dateStr = String(req.query.date);
  const org = await db.organization.findUnique({ where: { slug: String(req.params.slug) } });
  if (!org) return fail(res, 404, 'ORGANIZATION_NOT_FOUND', 'Barbería no encontrada.');

  const dayStart = new Date(`${dateStr}T00:00:00-05:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59-05:00`);
  const reqDate = new Date(`${dateStr}T12:00:00-05:00`);
  const dayOfWeek = reqDate.getDay(); // 0: Dom, 1: Lun...

  // 1. Verificar si todo el día fue cerrado manualmente por el barbero
  const fullDayBlock = await db.blockedSlot.findFirst({
    where: {
      organizationId: org.id,
      startsAt: { lte: dayStart },
      endsAt: { gte: dayEnd }
    }
  });

  if (fullDayBlock) {
    return res.json({ success: true, data: [], isClosed: true });
  }

  // 2. Obtener el horario configurado para este día de la semana
  const barber = await db.barber.findFirst({ where: { organizationId: org.id, active: true } });
  const schedule = await db.daySchedule.findFirst({
    where: {
      organizationId: org.id,
      weekday: dayOfWeek,
      OR: [{ barberId: barber?.id || null }, { barberId: null }]
    },
    orderBy: { barberId: 'desc' }
  });

  // Si el barbero marcó este día como no laborable por defecto
  if (schedule?.closed) {
    return res.json({ success: true, data: [], isClosed: true });
  }

  const openTime = schedule?.openTime || '09:00';
  const closeTime = schedule?.closeTime || '20:00'; // Soporta hasta las 8pm para permitir turnos de 7pm
  const breakStart = schedule?.breakStart;
  const breakEnd = schedule?.breakEnd;

  // 3. Traer citas, bloqueos y turnos VIP del día
  const [appointments, blocks, vips, service] = await Promise.all([
    db.appointment.findMany({
      where: {
        organizationId: org.id,
        status: AppointmentStatus.CONFIRMED,
        startsAt: { gte: dayStart, lte: dayEnd }
      }
    }),
    db.blockedSlot.findMany({
      where: {
        organizationId: org.id,
        startsAt: { gte: dayStart, lte: dayEnd }
      }
    }),
    db.vipSchedule.findMany({
      where: {
        organizationId: org.id,
        weekday: dayOfWeek,
        active: true
      },
      include: { exceptions: true }
    }),
    db.service.findFirst({ where: { organizationId: org.id, active: true } })
  ]);

  const durationMin = service?.durationMinutes || 45;

  // Generación dinámica de franjas horarias
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openMinutesTotal = openH * 60 + openM;
  const closeMinutesTotal = closeH * 60 + closeM;

  const freeSlots: { time: string }[] = [];

  for (let m = openMinutesTotal; m + durationMin <= closeMinutesTotal; m += durationMin) {
    const slotH = Math.floor(m / 60).toString().padStart(2, '0');
    const slotM = (m % 60).toString().padStart(2, '0');
    const slotTime = `${slotH}:${slotM}`;

    // Verificar si cae en hora de almuerzo / descanso
    let inBreak = false;
    if (breakStart && breakEnd) {
      const [bsH, bsM] = breakStart.split(':').map(Number);
      const [beH, beM] = breakEnd.split(':').map(Number);
      const bsTotal = bsH * 60 + bsM;
      const beTotal = beH * 60 + beM;
      if (m < beTotal && m + durationMin > bsTotal) {
        inBreak = true;
      }
    }

    const isBooked = appointments.some(a => toBogotaHour(a.startsAt) === slotTime);
    const isBlocked = blocks.some(b => toBogotaHour(b.startsAt) === slotTime);

    // Verificar si está ocupado por un VIP (a menos que tenga excepción de cambio)
    const isVipLocked = vips.some(v => {
      if (v.time !== slotTime) return false;
      const isSkippedThisDay = v.exceptions?.some(e => {
        const exDate = new Date(e.date).toISOString().split('T')[0];
        return exDate === dateStr;
      });
      return !isSkippedThisDay;
    });

    if (!inBreak && !isBooked && !isBlocked && !isVipLocked) {
      freeSlots.push({ time: slotTime });
    }
  }

  res.json({ success: true, data: freeSlots, isClosed: false });
}));

// 2. AUTHENTICATION
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const v = z.object({ email: z.string(), password: z.string().min(4) }).parse(req.body);
  
  const user = await db.user.findFirst({
    where: { OR: [{ email: v.email }, { phone: v.email }] },
    include: { organization: true, client: true }
  });

  if (!user || !user.active || !(await bcrypt.compare(v.password, user.passwordHash))) {
    return fail(res, 401, 'INVALID_CREDENTIALS', 'Celular o contraseña incorrecta.');
  }

  let isVip = false;
  let vipInfo = null;
  if (user.client) {
    const vSchedule = await db.vipSchedule.findFirst({
      where: { clientId: user.client.id, active: true },
      include: { barber: true }
    });
    if (vSchedule) {
      isVip = true;
      vipInfo = {
        id: vSchedule.id,
        weekday: vSchedule.weekday,
        time: vSchedule.time,
        barberName: vSchedule.barber?.displayName || 'Tu Barbero'
      };
    }
  }

  const token = tokenFor(user);
  res.cookie('access_token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
     .json({ success: true, data: { token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, organizationId: user.organizationId, isVip, vipInfo } } });
}));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const v = z.object({
    slug: z.string(),
    name: z.string().min(2),
    phone: z.string().min(7),
    password: z.string().min(4)
  }).parse(req.body);

  const org = await db.organization.findUnique({ where: { slug: v.slug } });
  if (!org) return fail(res, 404, 'ORGANIZATION_NOT_FOUND', 'Barbería no encontrada.');

  const cleanPhone = v.phone.replace(/[^0-9+]/g, '');
  const generatedEmail = `${cleanPhone.replace('+', '')}@cliente.local`;
  const passwordHash = await bcrypt.hash(v.password, 10);

  const existingUser = await db.user.findFirst({
    where: { organizationId: org.id, phone: cleanPhone }
  });

  if (existingUser) {
    return fail(res, 400, 'PHONE_EXISTS', 'Ya existe una cuenta con este número de celular. Por favor inicia sesión.');
  }

  const user = await db.user.create({
    data: {
      name: v.name,
      phone: cleanPhone,
      email: generatedEmail,
      passwordHash,
      role: Role.CLIENT,
      organizationId: org.id,
      client: {
        create: {
          organizationId: org.id,
          name: v.name,
          phone: cleanPhone,
          verifiedAt: new Date()
        }
      }
    },
    include: { client: true }
  });

  const token = tokenFor(user);
  res.cookie('access_token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
     .status(201)
     .json({
       success: true,
       data: {
         token,
         user: { id: user.id, name: user.name, phone: user.phone, role: user.role, organizationId: user.organizationId, isVip: false, vipInfo: null }
       }
     });
}));

app.post('/api/auth/logout', (_q, res) => {
  res.clearCookie('access_token').json({ success: true });
});

// 3. GESTIÓN DE HORARIOS SEMANALES DEL BARBERO
app.get('/api/schedules', auth, activeTenant, asyncRoute(async (req, res) => {
  const orgId = req.auth!.organizationId!;
  const barber = await db.barber.findFirst({ where: { organizationId: orgId } });
  
  const schedules = await db.daySchedule.findMany({
    where: { organizationId: orgId, OR: [{ barberId: barber?.id || null }, { barberId: null }] },
    orderBy: { weekday: 'asc' }
  });

  res.json({ success: true, data: schedules });
}));

app.put('/api/schedules', auth, activeTenant, asyncRoute(async (req, res) => {
  const { schedules } = req.body; // Array de los 7 días
  const orgId = req.auth!.organizationId!;
  const barber = await db.barber.findFirst({ where: { organizationId: orgId } });

  for (const s of schedules) {
    await db.daySchedule.upsert({
      where: {
        organizationId_barberId_weekday: {
          organizationId: orgId,
          barberId: barber?.id || '',
          weekday: Number(s.weekday)
        }
      },
      update: {
        openTime: s.openTime || '09:00',
        closeTime: s.closeTime || '20:00',
        breakStart: s.breakStart || null,
        breakEnd: s.breakEnd || null,
        closed: !!s.closed
      },
      create: {
        organizationId: orgId,
        barberId: barber?.id || '',
        weekday: Number(s.weekday),
        openTime: s.openTime || '09:00',
        closeTime: s.closeTime || '20:00',
        breakStart: s.breakStart || null,
        breakEnd: s.breakEnd || null,
        closed: !!s.closed
      }
    });
  }

  res.json({ success: true });
}));

// 4. GESTIÓN DE SERVICIOS Y PRECIOS
app.get('/api/services', auth, activeTenant, asyncRoute(async (req, res) => {
  const services = await db.service.findMany({
    where: { organizationId: req.auth!.organizationId!, active: true },
    orderBy: { price: 'asc' }
  });
  res.json({ success: true, data: services });
}));

app.patch('/api/services/:id', auth, activeTenant, asyncRoute(async (req, res) => {
  const { price, durationMinutes, name } = req.body;
  const updated = await db.service.update({
    where: { id: String(req.params.id) },
    data: {
      ...(price ? { price: Number(price) } : {}),
      ...(durationMinutes ? { durationMinutes: Number(durationMinutes) } : {}),
      ...(name ? { name } : {})
    }
  });
  res.json({ success: true, data: updated });
}));

// 5. CITAS Y RESERVAS
app.post('/api/appointments', auth, activeTenant, asyncRoute(async (req, res) => {
  try {
    const v = z.object({
      serviceId: z.string().min(1),
      barberId: z.string().optional().nullable(),
      startsAt: z.coerce.date()
    }).parse(req.body);

    const orgId = req.auth!.organizationId!;
    const u = await db.user.findUniqueOrThrow({ where: { id: req.auth!.id }, include: { client: true } });

    let client = u.client;
    if (!client) {
      client = await db.client.findFirst({ where: { userId: u.id } });
    }
    if (!client && u.phone) {
      client = await db.client.findFirst({ where: { organizationId: orgId, phone: u.phone } });
    }
    if (!client) {
      client = await db.client.create({
        data: {
          organizationId: orgId,
          userId: u.id,
          name: u.name,
          phone: u.phone || '+573000000000',
          verifiedAt: new Date()
        }
      });
    }

    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const isVip = await db.vipSchedule.findFirst({ where: { clientId: client.id, active: true } });

    const activeCount = await db.appointment.count({
      where: {
        clientId: client.id,
        status: AppointmentStatus.CONFIRMED,
        startsAt: { gte: now, lte: next7Days }
      }
    });

    const maxAllowed = isVip ? 3 : 2;
    if (activeCount >= maxAllowed) {
      return fail(res, 400, 'LIMIT_REACHED', `Has alcanzado el límite máximo de ${maxAllowed} citas activas para esta semana.`);
    }

    const service = await db.service.findFirst({ where: { id: v.serviceId, organizationId: orgId } });
    if (!service) return fail(res, 404, 'SERVICE_NOT_FOUND', 'Servicio no encontrado.');

    let barberId = v.barberId;
    if (!barberId) {
      const b = await db.barber.findFirst({ where: { organizationId: orgId, active: true } });
      barberId = b?.id;
    }
    if (!barberId) return fail(res, 404, 'BARBER_NOT_FOUND', 'No hay barberos disponibles.');

    const endsAt = new Date(v.startsAt.getTime() + (service.durationMinutes || 45) * 60000);

    const appointment = await db.appointment.create({
      data: {
        organizationId: orgId,
        barberId,
        clientId: client.id,
        serviceId: service.id,
        clientName: u.name,
        clientPhone: u.phone || client.phone,
        startsAt: v.startsAt,
        endsAt,
        price: service.price,
        status: AppointmentStatus.CONFIRMED
      }
    });

    res.status(201).json({ success: true, data: appointment });
  } catch (error: any) {
    console.error('ERROR EN APPOINTMENT:', error);
    return fail(res, 400, 'BOOKING_FAILED', error.message || 'No se pudo agendar la cita.');
  }
}));

app.get('/api/appointments', auth, activeTenant, asyncRoute(async (req, res) => {
  const where: any = { organizationId: req.auth!.organizationId! };
  if (req.auth!.role === Role.CLIENT) {
    const c = await db.client.findFirst({ where: { userId: req.auth!.id } });
    if (!c) return res.json({ success: true, data: [] });
    where.clientId = c.id;
  }

  const appointments = await db.appointment.findMany({
    where,
    include: { service: true, barber: true },
    orderBy: { startsAt: 'asc' }
  });
  res.json({ success: true, data: appointments });
}));

app.patch('/api/appointments/:id/cancel', auth, activeTenant, asyncRoute(async (req, res) => {
  const a = await db.appointment.findFirst({
    where: { id: String(req.params.id), organizationId: req.auth!.organizationId! }
  });
  if (!a) return fail(res, 404, 'NOT_FOUND', 'Cita no encontrada.');

  await db.appointment.update({
    where: { id: a.id },
    data: { status: AppointmentStatus.CANCELLED }
  });

  res.json({ success: true });
}));

// 6. BLOQUEOS
app.get('/api/blocks', auth, activeTenant, asyncRoute(async (req, res) => {
  const blocks = await db.blockedSlot.findMany({
    where: { organizationId: req.auth!.organizationId! },
    orderBy: { startsAt: 'asc' }
  });
  res.json({ success: true, data: blocks });
}));

app.post('/api/blocks', auth, activeTenant, asyncRoute(async (req, res) => {
  const v = z.object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    reason: z.string().optional()
  }).parse(req.body);

  const block = await db.blockedSlot.create({
    data: {
      organizationId: req.auth!.organizationId!,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      reason: v.reason || 'Descanso'
    }
  });

  res.status(201).json({ success: true, data: block });
}));

app.post('/api/blocks/day', auth, activeTenant, asyncRoute(async (req, res) => {
  const { dateStr, reason } = req.body;
  const startsAt = new Date(`${dateStr}T00:00:00-05:00`);
  const endsAt = new Date(`${dateStr}T23:59:59-05:00`);

  await db.blockedSlot.deleteMany({
    where: {
      organizationId: req.auth!.organizationId!,
      startsAt: { gte: startsAt },
      endsAt: { lte: endsAt }
    }
  });

  const block = await db.blockedSlot.create({
    data: {
      organizationId: req.auth!.organizationId!,
      startsAt,
      endsAt,
      reason: reason || 'Día Cerrado'
    }
  });

  res.status(201).json({ success: true, data: block });
}));

app.delete('/api/blocks/day/:dateStr', auth, activeTenant, asyncRoute(async (req, res) => {
  const dateStr = String(req.params.dateStr);
  const startsAt = new Date(`${dateStr}T00:00:00-05:00`);
  const endsAt = new Date(`${dateStr}T23:59:59-05:00`);

  await db.blockedSlot.deleteMany({
    where: {
      organizationId: req.auth!.organizationId!,
      startsAt: { gte: startsAt },
      endsAt: { lte: endsAt }
    }
  });

  res.json({ success: true });
}));

app.delete('/api/blocks/:id', auth, activeTenant, asyncRoute(async (req, res) => {
  await db.blockedSlot.deleteMany({
    where: { id: String(req.params.id), organizationId: req.auth!.organizationId! }
  });
  res.json({ success: true });
}));

// 7. CLIENTES Y MÓDULO VIP
app.get('/api/clients', auth, activeTenant, asyncRoute(async (req, res) => {
  const clients = await db.client.findMany({
    where: { organizationId: req.auth!.organizationId! },
    include: {
      _count: { select: { appointments: true } },
      vipSchedules: { where: { active: true } }
    },
    orderBy: { name: 'asc' }
  });
  res.json({ success: true, data: clients });
}));

app.get('/api/vip', auth, activeTenant, asyncRoute(async (req, res) => {
  const vips = await db.vipSchedule.findMany({
    where: { organizationId: req.auth!.organizationId! },
    include: { client: true, barber: true, exceptions: true }
  });
  res.json({ success: true, data: vips });
}));

app.get('/api/vip/my-schedule', auth, activeTenant, asyncRoute(async (req, res) => {
  const client = await db.client.findFirst({ where: { userId: req.auth!.id } });
  if (!client) return res.json({ success: true, data: null });

  const vip = await db.vipSchedule.findFirst({
    where: { clientId: client.id, active: true },
    include: { barber: true, exceptions: true }
  });

  res.json({ success: true, data: vip });
}));

app.post('/api/vip', auth, activeTenant, asyncRoute(async (req, res) => {
  const v = z.object({
    clientId: z.string(),
    weekday: z.number().int().min(0).max(6),
    time: z.string()
  }).parse(req.body);

  const barber = await db.barber.findFirst({ where: { organizationId: req.auth!.organizationId! } });
  if (!barber) return fail(res, 404, 'BARBER_NOT_FOUND', 'Barbero no encontrado.');

  // VALIDACIÓN: Verificar si ya existe otro VIP en ese mismo día y hora
  const existingVip = await db.vipSchedule.findFirst({
    where: {
      organizationId: req.auth!.organizationId!,
      weekday: v.weekday,
      time: v.time,
      active: true
    },
    include: { client: true }
  });

  if (existingVip) {
    return fail(
      res,
      409,
      'VIP_SLOT_TAKEN',
      `Este horario ya está asignado a otro cliente VIP (${existingVip.client?.name || 'Cliente registrado'}). Por favor elige otra hora.`
    );
  }

  const vip = await db.vipSchedule.create({
    data: {
      organizationId: req.auth!.organizationId!,
      barberId: barber.id,
      clientId: v.clientId,
      weekday: v.weekday,
      time: v.time,
      frequency: VipFrequency.WEEKLY
    },
    include: { client: true }
  });

  res.status(201).json({ success: true, data: vip });
}));

app.delete('/api/vip/:id', auth, activeTenant, asyncRoute(async (req, res) => {
  await db.vipSchedule.deleteMany({
    where: { id: String(req.params.id), organizationId: req.auth!.organizationId! }
  });
  res.json({ success: true });
}));

app.post('/api/vip/reschedule-week', auth, activeTenant, asyncRoute(async (req, res) => {
  const { vipId, originalDateStr, newDateStr, newTime } = req.body;
  const originalDate = new Date(`${originalDateStr}T12:00:00-05:00`);

  await db.vipException.upsert({
    where: {
      vipScheduleId_date: {
        vipScheduleId: vipId,
        date: originalDate
      }
    },
    update: { type: VipExceptionType.SKIP },
    create: {
      vipScheduleId: vipId,
      date: originalDate,
      type: VipExceptionType.SKIP
    }
  });

  const u = await db.user.findUniqueOrThrow({ where: { id: req.auth!.id }, include: { client: true } });
  const barber = await db.barber.findFirst({ where: { organizationId: req.auth!.organizationId! } });
  const service = await db.service.findFirst({ where: { organizationId: req.auth!.organizationId! } });

  const startsAt = new Date(`${newDateStr}T${newTime}:00-05:00`);
  const endsAt = new Date(startsAt.getTime() + (service?.durationMinutes || 45) * 60000);

  const newAppointment = await db.appointment.create({
    data: {
      organizationId: req.auth!.organizationId!,
      barberId: barber?.id || '',
      clientId: u.client!.id,
      serviceId: service?.id || '',
      clientName: u.name,
      clientPhone: u.phone || u.client!.phone,
      startsAt,
      endsAt,
      price: service?.price || 25000,
      status: AppointmentStatus.CONFIRMED
    }
  });

  res.json({ success: true, data: newAppointment });
}));

// 8. SUPERADMIN
app.get('/api/superadmin/stats', auth, role(Role.SUPERADMIN), asyncRoute(async (_q, res) => {
  const [total, active, suspended, totalBarbers, totalAppointments] = await Promise.all([
    db.organization.count(),
    db.organization.count({ where: { status: OrganizationStatus.ACTIVE } }),
    db.organization.count({ where: { status: OrganizationStatus.SUSPENDED } }),
    db.barber.count(),
    db.appointment.count()
  ]);
  res.json({
    success: true,
    data: {
      totalOrganizations: total,
      active,
      suspended,
      expiringSoon: await db.organization.count({ where: { subscriptionExpiresAt: { lte: new Date(Date.now() + 7 * 864e5), gt: new Date() } } }),
      totalBarbers,
      totalAppointments
    }
  });
}));

app.get('/api/superadmin/organizations', auth, role(Role.SUPERADMIN), asyncRoute(async (_q, res) => {
  const orgs = await db.organization.findMany({
    include: { _count: { select: { barbers: true, appointments: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, data: orgs });
}));

app.post('/api/superadmin/organizations', auth, role(Role.SUPERADMIN), asyncRoute(async (req, res) => {
  const v = z.object({
    name: z.string().min(2),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    subscriptionExpiresAt: z.coerce.date(),
    maxBarbers: z.number().int().min(1).max(100)
  }).parse(req.body);
  res.status(201).json({ success: true, data: await db.organization.create({ data: v }) });
}));

app.patch('/api/superadmin/organizations/:id', auth, role(Role.SUPERADMIN), asyncRoute(async (req, res) => {
  const v = z.object({
    status: z.nativeEnum(OrganizationStatus).optional(),
    subscriptionExpiresAt: z.coerce.date().optional(),
    maxBarbers: z.number().int().min(1).max(100).optional(),
    name: z.string().min(2).optional()
  }).parse(req.body);
  res.json({ success: true, data: await db.organization.update({ where: { id: String(req.params.id) }, data: v }) });
}));

app.use((err: any, _q: Request, res: Response, _n: NextFunction) => {
  if (err instanceof z.ZodError) return fail(res, 422, 'VALIDATION_ERROR', err.issues.map(x => x.message).join(', '));
  console.error(err);
  return fail(res, 500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.');
});

app.listen(PORT, () => console.log(`ASYS API on :${PORT}`));