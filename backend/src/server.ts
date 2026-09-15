import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient, Role, AppointmentStatus, OrganizationStatus, VipExceptionType, VipFrequency } from '@prisma/client';
import { z } from 'zod';

const db = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_long_enough_2026';

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || 'https://app.asysdigital.com', credentials: true }));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60_000, max: 600, standardHeaders: true, legacyHeaders: false }));

type Auth = { id: string; role: Role; organizationId: string | null };
declare global { namespace Express { interface Request { auth?: Auth } } }

const fail = (res: Response, status: number, code: string, message: string) => res.status(status).json({ success: false, error: { code, message } });
const asyncRoute = (fn: (r: Request, s: Response, n: NextFunction) => Promise<unknown>) => (r: Request, s: Response, n: NextFunction) => void fn(r, s, n).catch(n);

function tokenFor(user: { id: string; role: Role; organizationId: string | null }) {
  return jwt.sign({ sub: user.id, role: user.role, organizationId: user.organizationId }, JWT_SECRET, { expiresIn: '8h' });
}

function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.access_token || req.headers.authorization?.replace(/^Bearer /, '');
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

const timeOnDate = (d: Date, time: string) => {
  const [h, m] = time.split(':').map(Number);
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
};

// 1. HEALTH & PUBLIC TENANT
app.get('/api/health', asyncRoute(async (_q, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
}));

app.get('/api/public/:slug', asyncRoute(async (req, res) => {
  const org = await db.organization.findUnique({
    where: { slug: String(req.params.slug) },
    include: {
      services: { where: { active: true } },
      barbers: { where: { active: true }, select: { id: true, displayName: true } },
      schedules: true
    }
  });
  if (!org) return fail(res, 404, 'ORGANIZATION_NOT_FOUND', 'Barbería no encontrada.');
  if (org.status !== OrganizationStatus.ACTIVE || org.subscriptionExpiresAt <= new Date()) {
    return fail(res, 403, 'ORGANIZATION_SUSPENDED', 'Esta barbería no está disponible temporalmente.');
  }
  res.json({ success: true, data: org });
}));

// Disponibilidad de citas
app.get('/api/public/:slug/availability', asyncRoute(async (req, res) => {
  const schema = z.object({
    date: z.coerce.date(),
    serviceId: z.string().optional(),
    barberId: z.string().optional()
  });
  const q = schema.parse(req.query);
  const org = await db.organization.findUnique({ where: { slug: String(req.params.slug) } });
  if (!org || org.status !== OrganizationStatus.ACTIVE || org.subscriptionExpiresAt <= new Date()) {
    return fail(res, 404, 'ORGANIZATION_UNAVAILABLE', 'Barbería no disponible.');
  }

  const duration = 45;
  const candidates = await db.barber.findMany({
    where: { organizationId: org.id, active: true, ...(q.barberId ? { id: q.barberId } : {}) }
  });

  const day = q.date.getDay();
  const result: { barberId: string; time: string }[] = [];

  for (const b of candidates) {
    const schedule = await db.daySchedule.findFirst({
      where: { organizationId: org.id, weekday: day, OR: [{ barberId: b.id }, { barberId: null }] },
      orderBy: { barberId: 'desc' }
    });

    // Horario por defecto 09:00 a 19:00 si no está configurado
    const openTime = schedule?.openTime || '09:00';
    const closeTime = schedule?.closeTime || '20:00';
    if (schedule?.closed) continue;

    const start = timeOnDate(q.date, openTime);
    const end = timeOnDate(q.date, closeTime);

    const appointments = await db.appointment.findMany({
      where: {
        barberId: b.id,
        status: AppointmentStatus.CONFIRMED,
        startsAt: { gte: new Date(q.date.toDateString()), lt: new Date(new Date(q.date).setDate(q.date.getDate() + 1)) }
      }
    });

    for (let slot = new Date(start); slot.getTime() + duration * 60000 <= end.getTime(); slot = new Date(slot.getTime() + 60 * 60000)) {
      const slotEnd = new Date(slot.getTime() + duration * 60000);
      const conflict = appointments.some(x => slot < x.endsAt && slotEnd > x.startsAt);
      if (!conflict) {
        result.push({ barberId: b.id, time: slot.toTimeString().slice(0, 5) });
      }
    }
  }

  res.json({ success: true, data: result });
}));

// 2. AUTH
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const v = z.object({ email: z.string().email(), password: z.string().min(6) }).parse(req.body);
  const user = await db.user.findUnique({ where: { email: v.email }, include: { organization: true } });
  if (!user || !user.active || !(await bcrypt.compare(v.password, user.passwordHash))) {
    return fail(res, 401, 'INVALID_CREDENTIALS', 'Credenciales inválidas.');
  }
  const token = tokenFor(user);
  res.cookie('access_token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
     .json({ success: true, data: { token, user: { id: user.id, name: user.name, role: user.role, organizationId: user.organizationId } } });
}));

// 3. APPOINTMENTS (Reserva corregida sin bloqueo de UUID)
app.post('/api/appointments', auth, activeTenant, role(Role.CLIENT), asyncRoute(async (req, res) => {
  const v = z.object({
    serviceId: z.string().min(1), // Permite cualquier ID de servicio
    barberId: z.string().optional().nullable(),
    startsAt: z.coerce.date()
  }).parse(req.body);

  const orgId = req.auth!.organizationId!;
  const client = await db.client.findUnique({ where: { userId: req.auth!.id } });
  if (!client) return fail(res, 403, 'CLIENT_REQUIRED', 'Perfil de cliente requerido.');

  const service = await db.service.findFirst({ where: { id: v.serviceId, organizationId: orgId } });
  if (!service) return fail(res, 404, 'SERVICE_NOT_FOUND', 'Servicio no encontrado.');

  let barberId = v.barberId;
  if (!barberId) {
    const b = await db.barber.findFirst({ where: { organizationId: orgId, active: true } });
    barberId = b?.id;
  }
  if (!barberId) return fail(res, 404, 'BARBER_NOT_FOUND', 'No hay barberos disponibles.');

  const endsAt = new Date(v.startsAt.getTime() + service.durationMinutes * 60000);

  const appointment = await db.appointment.create({
    data: {
      organizationId: orgId,
      barberId,
      clientId: client.id,
      serviceId: service.id,
      clientName: client.name,
      clientPhone: client.phone,
      startsAt: v.startsAt,
      endsAt,
      price: service.price,
      status: AppointmentStatus.CONFIRMED
    }
  });

  res.status(201).json({ success: true, data: appointment });
}));

app.get('/api/appointments', auth, activeTenant, asyncRoute(async (req, res) => {
  const appointments = await db.appointment.findMany({
    where: { organizationId: req.auth!.organizationId! },
    include: { service: true, barber: true },
    orderBy: { startsAt: 'desc' }
  });
  res.json({ success: true, data: appointments });
}));

// 4. SUPERADMIN (Habilitada la consulta y gestión de todas las barberías)
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