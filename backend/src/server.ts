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

// Convertir fechas a hora exacta de Colombia (America/Bogota)
const toBogotaHour = (date: Date) => {
  return date.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false });
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
  res.json({ success: true, data: org });
}));

// Disponibilidad sincronizada con hora de Colombia
app.get('/api/public/:slug/availability', asyncRoute(async (req, res) => {
  const dateStr = String(req.query.date);
  const org = await db.organization.findUnique({ where: { slug: String(req.params.slug) } });
  if (!org) return fail(res, 404, 'ORGANIZATION_NOT_FOUND', 'Barbería no encontrada.');

  const dayStart = new Date(`${dateStr}T00:00:00-05:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59-05:00`);

  // Citas y bloqueos del día
  const [appointments, blocks] = await Promise.all([
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
    })
  ]);

  const masterHours = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
  const freeSlots: { time: string }[] = [];

  for (const h of masterHours) {
    const isBooked = appointments.some(a => toBogotaHour(a.startsAt) === h);
    const isBlocked = blocks.some(b => toBogotaHour(b.startsAt) === h);

    if (!isBooked && !isBlocked) {
      freeSlots.push({ time: h });
    }
  }

  res.json({ success: true, data: freeSlots });
}));

// 2. AUTHENTICATION (Login y Registro Directo)
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

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const v = z.object({
    slug: z.string(),
    name: z.string().min(2),
    phone: z.string().min(8),
    password: z.string().min(6),
    email: z.string().email().optional()
  }).parse(req.body);

  const org = await db.organization.findUnique({ where: { slug: v.slug } });
  if (!org) return fail(res, 404, 'ORGANIZATION_NOT_FOUND', 'Barbería no encontrada.');

  const clientEmail = v.email || `${v.phone.replace(/[^0-9]/g, '')}@asysbarber.local`;
  const passwordHash = await bcrypt.hash(v.password, 10);

  const user = await db.user.create({
    data: {
      name: v.name,
      phone: v.phone,
      email: clientEmail,
      passwordHash,
      role: Role.CLIENT,
      organizationId: org.id,
      client: {
        create: {
          organizationId: org.id,
          name: v.name,
          phone: v.phone,
          verifiedAt: new Date()
        }
      }
    }
  });

  const token = tokenFor(user);
  res.status(201).json({ success: true, data: { token, user } });
}));

// 3. CITAS (Crear, Listar y Cancelar)
app.post('/api/appointments', auth, activeTenant, asyncRoute(async (req, res) => {
  const v = z.object({
    serviceId: z.string().min(1),
    barberId: z.string().optional().nullable(),
    startsAt: z.coerce.date()
  }).parse(req.body);

  const orgId = req.auth!.organizationId!;
  let client = await db.client.findUnique({ where: { userId: req.auth!.id } });
  
  if (!client) {
    const u = await db.user.findUniqueOrThrow({ where: { id: req.auth!.id } });
    client = await db.client.create({
      data: { organizationId: orgId, userId: u.id, name: u.name, phone: u.phone || '+573000000000' }
    });
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
    orderBy: { startsAt: 'asc' }
  });
  res.json({ success: true, data: appointments });
}));

// Cancelar Cita
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

// 4. BLOQUEOS DE HORA
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

app.delete('/api/blocks/:id', auth, activeTenant, asyncRoute(async (req, res) => {
  await db.blockedSlot.deleteMany({
    where: { id: String(req.params.id), organizationId: req.auth!.organizationId! }
  });
  res.json({ success: true });
}));

// 5. CLIENTES VIP
app.get('/api/vip', auth, activeTenant, asyncRoute(async (req, res) => {
  const vips = await db.vipSchedule.findMany({
    where: { organizationId: req.auth!.organizationId! },
    include: { client: true, barber: true }
  });
  res.json({ success: true, data: vips });
}));

app.delete('/api/vip/:id', auth, activeTenant, asyncRoute(async (req, res) => {
  await db.vipSchedule.deleteMany({
    where: { id: String(req.params.id), organizationId: req.auth!.organizationId! }
  });
  res.json({ success: true });
}));

// 6. SUPERADMIN
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