import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { PrismaClient, Role, AppointmentStatus, OrganizationStatus, VipExceptionType, VipFrequency } from '@prisma/client';
import { z } from 'zod';

const db = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_long_enough_2026';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';

// Configuración de uploads
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `logo-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  }
});

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60_000, max: 1000, standardHeaders: true, legacyHeaders: false }));
app.use('/uploads', express.static(UPLOADS_DIR));

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
  if (req.auth?.role === Role.SUPERADMIN) return next();
  if (!req.auth?.organizationId) return fail(res, 403, 'TENANT_REQUIRED', 'Esta acción requiere una barbería.');
  const o = await db.organization.findUnique({ where: { id: req.auth.organizationId } });
  if (!o || o.status !== OrganizationStatus.ACTIVE || (o.subscriptionExpiresAt && o.subscriptionExpiresAt <= new Date())) {
    return fail(res, 403, 'ORGANIZATION_SUSPENDED', 'Esta barbería no está disponible temporalmente por suscripción.');
  }
  next();
}

const toBogotaHour = (date: Date) => {
  return date.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false });
};

// Disparador genérico a n8n
async function triggerN8N(payload: any) {
  if (!N8N_WEBHOOK_URL) return;
  try {
    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Error enviando notificación a n8n:', err);
  }
}

const MASTER_HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

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
      barbers: { where: { active: true }, select: { id: true, displayName: true, priority: true }, orderBy: { priority: 'asc' } },
      schedules: true,
      blockedSlots: true
    }
  });
  if (!org) return fail(res, 404, 'ORGANIZATION_NOT_FOUND', 'Barbería no encontrada.');

  const isSuspended = org.status !== OrganizationStatus.ACTIVE || (org.subscriptionExpiresAt && org.subscriptionExpiresAt <= new Date());

  res.json({
    success: true,
    data: {
      ...org,
      isSuspended
    }
  });
}));

// DISPONIBILIDAD EXACTA
app.get('/api/public/:slug/availability', asyncRoute(async (req, res) => {
  const dateStr = String(req.query.date);
  const barberIdParam = req.query.barberId ? String(req.query.barberId) : null;
  const org = await db.organization.findUnique({ where: { slug: String(req.params.slug) } });
  if (!org) return fail(res, 404, 'ORGANIZATION_NOT_FOUND', 'Barbería no encontrada.');

  if (org.status !== OrganizationStatus.ACTIVE || (org.subscriptionExpiresAt && org.subscriptionExpiresAt <= new Date())) {
    return res.json({
      success: true,
      data: {
        slots: [],
        isClosed: true,
        isSuspended: true,
        status: 'closed',
        statusText: 'Suspendida',
        freeSlotsCount: 0,
        totalSlots: 0
      }
    });
  }

  const dayStart = new Date(`${dateStr}T00:00:00-05:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59-05:00`);
  const reqDate = new Date(`${dateStr}T12:00:00-05:00`);
  const dayOfWeek = reqDate.getDay();

  const whereBarbers: any = { organizationId: org.id, active: true };
  if (barberIdParam && barberIdParam !== 'any' && barberIdParam !== '') {
    whereBarbers.id = barberIdParam;
  }

  const barbers = await db.barber.findMany({
    where: whereBarbers,
    orderBy: { priority: 'asc' }
  });

  if (barbers.length === 0) {
    return res.json({
      success: true,
      data: {
        slots: [],
        isClosed: true,
        status: 'closed',
        statusText: 'Sin barberos',
        freeSlotsCount: 0,
        totalSlots: 0
      }
    });
  }

  const [schedules, fullDayBlocks, appointments, blocks, vips] = await Promise.all([
    db.daySchedule.findMany({
      where: {
        organizationId: org.id,
        weekday: dayOfWeek,
        OR: [{ barberId: { in: barbers.map(b => b.id) } }, { barberId: null }]
      }
    }),
    db.blockedSlot.findMany({
      where: {
        organizationId: org.id,
        startsAt: { lte: dayStart },
        endsAt: { gte: dayEnd }
      }
    }),
    db.appointment.findMany({
      where: {
        organizationId: org.id,
        barberId: { in: barbers.map(b => b.id) },
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
        barberId: { in: barbers.map(b => b.id) },
        weekday: dayOfWeek,
        active: true
      },
      include: { exceptions: true }
    })
  ]);

  let allBarbersClosed = true;
  const availableSlotsSet = new Set<string>();
  let maxPossibleSlots = 0;

  for (const b of barbers) {
    const isBFullDayBlocked = fullDayBlocks.some(blk => blk.barberId === b.id || !blk.barberId);
    const bSchedule = schedules.find(s => s.barberId === b.id) || schedules.find(s => s.barberId === null);
    if (isBFullDayBlocked || bSchedule?.closed) continue;

    allBarbersClosed = false;

    const openH = Number((bSchedule?.openTime || '09:00').slice(0, 2));
    const closeH = Number((bSchedule?.closeTime || '20:00').slice(0, 2));

    const bWorkingSlots = MASTER_HOURS.filter(h => {
      const slotH = Number(h.slice(0, 2));
      return slotH >= openH && slotH < closeH;
    });

    if (bWorkingSlots.length > maxPossibleSlots) {
      maxPossibleSlots = bWorkingSlots.length;
    }

    for (const h of bWorkingSlots) {
      const isBooked = appointments.some(a => a.barberId === b.id && toBogotaHour(a.startsAt) === h);
      const isBlocked = blocks.some(blk => (blk.barberId === b.id || !blk.barberId) && toBogotaHour(blk.startsAt) === h);
      const isVipLocked = vips.some(v => {
        if (v.barberId !== b.id || v.time !== h) return false;
        const isSkipped = v.exceptions?.some(e => new Date(e.date).toISOString().split('T')[0] === dateStr);
        return !isSkipped;
      });

      if (!isBooked && !isBlocked && !isVipLocked) {
        availableSlotsSet.add(h);
      }
    }
  }

  if (allBarbersClosed) {
    return res.json({
      success: true,
      data: {
        slots: [],
        isClosed: true,
        status: 'closed',
        statusText: 'Cerrado',
        freeSlotsCount: 0,
        totalSlots: 0
      }
    });
  }

  const freeSlots = MASTER_HOURS.filter(h => availableSlotsSet.has(h)).map(time => ({ time }));
  const freeSlotsCount = freeSlots.length;

  let status = 'green';
  let statusText = `${freeSlotsCount} libres ●`;

  if (maxPossibleSlots === 0 || freeSlotsCount === 0) {
    status = 'full';
    statusText = 'Lleno ●';
  } else if (freeSlotsCount <= 2 || (freeSlotsCount / maxPossibleSlots) <= 0.5) {
    status = 'yellow';
    statusText = `${freeSlotsCount} libres ●`;
  } else {
    status = 'green';
    statusText = `${freeSlotsCount} libres ●`;
  }

  res.json({
    success: true,
    data: {
      slots: freeSlots,
      isClosed: false,
      status,
      statusText,
      freeSlotsCount,
      totalSlots: maxPossibleSlots
    }
  });
}));

// 2. AUTHENTICATION & VERIFICACIÓN OTP POR WHATSAPP (N8N)
app.post('/api/auth/send-otp', asyncRoute(async (req, res) => {
  const v = z.object({
    slug: z.string(),
    phone: z.string().min(7)
  }).parse(req.body);

  const org = await db.organization.findUnique({ where: { slug: v.slug } });
  if (!org) return fail(res, 404, 'ORGANIZATION_NOT_FOUND', 'Barbería no encontrada.');

  let cleanPhone = v.phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) cleanPhone = `57${cleanPhone}`; // Formato internacional Colombia

  // Generar código de 6 dígitos numéricos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  // Guardar en la tabla Otp
  await db.otp.create({
    data: {
      organizationId: org.id,
      phone: cleanPhone,
      codeHash,
      expiresAt
    }
  });

  // Disparar a n8n para envío por WhatsApp
  triggerN8N({
    tipo: 'OTP',
    phone: cleanPhone,
    code,
    tenantName: org.name
  });

  res.json({
    success: true,
    data: {
      message: 'Código de verificación enviado por WhatsApp exitosamente.'
    }
  });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const v = z.object({
    email: z.string(),
    password: z.string().min(4),
    slug: z.string().optional()
  }).parse(req.body);

  const cleanLogin = v.email.trim();
  const cleanPhone = cleanLogin.replace(/[^0-9+]/g, '');

  let targetOrgId: string | undefined;
  if (v.slug) {
    const org = await db.organization.findUnique({ where: { slug: v.slug } });
    if (org) targetOrgId = org.id;
  }

  const whereClause: any = {
    OR: [
      { email: cleanLogin },
      { phone: cleanPhone }
    ]
  };

  if (targetOrgId) {
    whereClause.OR = [
      { email: cleanLogin, organizationId: targetOrgId },
      { phone: cleanPhone, organizationId: targetOrgId },
      { email: cleanLogin, role: Role.SUPERADMIN }
    ];
  }

  const user = await db.user.findFirst({
    where: whereClause,
    include: { organization: true, client: true, barber: true }
  });

  if (!user || !user.active || !(await bcrypt.compare(v.password, user.passwordHash))) {
    return fail(res, 401, 'INVALID_CREDENTIALS', 'Celular o contraseña incorrecta.');
  }

  if (user.role !== Role.SUPERADMIN && user.organization) {
    const isSuspended = user.organization.status !== OrganizationStatus.ACTIVE ||
      (user.organization.subscriptionExpiresAt && user.organization.subscriptionExpiresAt <= new Date());
    if (isSuspended) {
      return fail(res, 403, 'ORGANIZATION_SUSPENDED', 'El acceso a esta barbería está pausado por administración.');
    }
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
     .json({
       success: true,
       data: {
         token,
         user: {
           id: user.id,
           name: user.name,
           phone: user.phone,
           role: user.role,
           organizationId: user.organizationId,
           organizationSlug: user.organization?.slug || null,
           isVip,
           vipInfo
         }
       }
     });
}));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const v = z.object({
    slug: z.string(),
    name: z.string().min(2),
    phone: z.string().min(7),
    password: z.string().min(4),
    code: z.string().min(4) // Código de WhatsApp obligatorio
  }).parse(req.body);

  const org = await db.organization.findUnique({ where: { slug: v.slug } });
  if (!org) return fail(res, 404, 'ORGANIZATION_NOT_FOUND', 'Barbería no encontrada.');

  let cleanPhone = v.phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) cleanPhone = `57${cleanPhone}`;

  // 1. VALIDAR CÓDIGO OTP
  const latestOtp = await db.otp.findFirst({
    where: {
      organizationId: org.id,
      phone: cleanPhone,
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!latestOtp || !(await bcrypt.compare(v.code, latestOtp.codeHash))) {
    return fail(res, 400, 'INVALID_OTP', 'El código de WhatsApp es incorrecto o ha vencido. Solicita uno nuevo.');
  }

  // Marcar OTP usado
  await db.otp.update({
    where: { id: latestOtp.id },
    data: { usedAt: new Date() }
  });

  const generatedEmail = `${cleanPhone}@${org.slug}.local`;
  const passwordHash = await bcrypt.hash(v.password, 10);

  const existingUser = await db.user.findFirst({
    where: { organizationId: org.id, phone: cleanPhone }
  });

  if (existingUser) {
    return fail(res, 400, 'PHONE_EXISTS', 'Ya existe una cuenta con este celular en esta barbería. Inicia sesión.');
  }

  const allowedBarber = await db.allowedBarber.findFirst({
    where: {
      organizationId: org.id,
      phone: cleanPhone
    }
  });

  if (allowedBarber) {
    const user = await db.user.create({
      data: {
        name: v.name,
        phone: cleanPhone,
        email: generatedEmail,
        passwordHash,
        role: Role.BARBER,
        organizationId: org.id,
        barber: {
          create: {
            organizationId: org.id,
            displayName: v.name,
            priority: allowedBarber.priority
          }
        }
      },
      include: { barber: true, organization: true }
    });

    await db.allowedBarber.update({
      where: { id: allowedBarber.id },
      data: { claimed: true }
    });

    for (let day = 0; day < 7; day++) {
      await db.daySchedule.upsert({
        where: {
          organizationId_barberId_weekday: {
            organizationId: org.id,
            barberId: user.barber!.id,
            weekday: day
          }
        },
        update: {},
        create: {
          organizationId: org.id,
          barberId: user.barber!.id,
          weekday: day,
          openTime: '09:00',
          closeTime: '20:00',
          closed: day === 0
        }
      });
    }

    const token = tokenFor(user);
    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          organizationId: user.organizationId,
          organizationSlug: user.organization?.slug,
          isVip: false,
          vipInfo: null
        }
      }
    });
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
    include: { client: true, organization: true }
  });

  const token = tokenFor(user);
  res.cookie('access_token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
     .status(201)
     .json({
       success: true,
       data: {
         token,
         user: {
           id: user.id,
           name: user.name,
           phone: user.phone,
           role: user.role,
           organizationId: user.organizationId,
           organizationSlug: user.organization?.slug,
           isVip: false,
           vipInfo: null
         }
       }
     });
}));

app.post('/api/auth/logout', (_q, res) => {
  res.clearCookie('access_token').json({ success: true });
});

// 3. HORARIOS
app.get('/api/schedules', auth, activeTenant, asyncRoute(async (req, res) => {
  const orgId = req.auth!.organizationId!;
  const barber = await db.barber.findFirst({ where: { userId: req.auth!.id } }) ||
                 await db.barber.findFirst({ where: { organizationId: orgId } });
  
  const schedules = await db.daySchedule.findMany({
    where: { organizationId: orgId, OR: [{ barberId: barber?.id || null }, { barberId: null }] },
    orderBy: { weekday: 'asc' }
  });
  res.json({ success: true, data: schedules });
}));

app.put('/api/schedules', auth, activeTenant, asyncRoute(async (req, res) => {
  const { schedules } = req.body;
  const orgId = req.auth!.organizationId!;
  const barber = await db.barber.findFirst({ where: { userId: req.auth!.id } }) ||
                 await db.barber.findFirst({ where: { organizationId: orgId } });

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

// 4. SERVICIOS
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

// 5. CITAS (CON DISPARADOR DE NOTIFICACIÓN ELEGANTE A N8N)
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
      return fail(res, 400, 'LIMIT_REACHED', `Has alcanzado el límite de ${maxAllowed} citas activas esta semana.`);
    }

    const [service, org] = await Promise.all([
      db.service.findFirst({ where: { id: v.serviceId, organizationId: orgId } }),
      db.organization.findUnique({ where: { id: orgId } })
    ]);

    if (!service) return fail(res, 404, 'SERVICE_NOT_FOUND', 'Servicio no encontrado.');

    const startsAt = v.startsAt;
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const slotHour = toBogotaHour(startsAt);
    const dayOfWeek = startsAt.getDay();

    let selectedBarberId = v.barberId && v.barberId !== 'any' ? v.barberId : null;

    if (!selectedBarberId) {
      const barbers = await db.barber.findMany({
        where: { organizationId: orgId, active: true },
        orderBy: { priority: 'asc' }
      });

      for (const b of barbers) {
        const hasApt = await db.appointment.findFirst({
          where: {
            barberId: b.id,
            status: AppointmentStatus.CONFIRMED,
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt }
          }
        });

        const hasBlock = await db.blockedSlot.findFirst({
          where: {
            organizationId: orgId,
            OR: [{ barberId: b.id }, { barberId: null }],
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt }
          }
        });

        const hasVip = await db.vipSchedule.findFirst({
          where: { barberId: b.id, weekday: dayOfWeek, time: slotHour, active: true }
        });

        if (!hasApt && !hasBlock && !hasVip) {
          selectedBarberId = b.id;
          break;
        }
      }
    } else {
      const hasApt = await db.appointment.findFirst({
        where: {
          barberId: selectedBarberId,
          status: AppointmentStatus.CONFIRMED,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt }
        }
      });

      if (hasApt) {
        return fail(res, 409, 'SLOT_OCCUPIED', 'Este barbero ya tiene una cita reservada a esta hora.');
      }
    }

    if (!selectedBarberId) {
      return fail(res, 409, 'SLOT_OCCUPIED', 'No hay barberos disponibles para esta hora.');
    }

    const appointment = await db.appointment.create({
      data: {
        organizationId: orgId,
        barberId: selectedBarberId,
        clientId: client.id,
        serviceId: service.id,
        clientName: u.name,
        clientPhone: u.phone || client.phone,
        startsAt,
        endsAt,
        price: service.price,
        status: AppointmentStatus.CONFIRMED
      },
      include: { barber: true }
    });

    // Disparar WhatsApp a n8n con el mensaje de cita agendada
    triggerN8N({
      tipo: 'APPOINTMENT_CONFIRMED',
      tenantName: org?.name || 'ASYS Barber',
      clientName: u.name,
      clientPhone: u.phone || client.phone,
      barberName: appointment.barber?.displayName || 'Tu Barbero',
      serviceName: service.name,
      price: service.price,
      date: startsAt.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' }),
      time: toBogotaHour(startsAt)
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
  } else if (req.auth!.role === Role.BARBER) {
    const b = await db.barber.findFirst({ where: { userId: req.auth!.id } });
    if (b) where.barberId = b.id;
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
  const where: any = { organizationId: req.auth!.organizationId! };
  if (req.auth!.role === Role.BARBER) {
    const b = await db.barber.findFirst({ where: { userId: req.auth!.id } });
    if (b) where.OR = [{ barberId: b.id }, { barberId: null }];
  }
  const blocks = await db.blockedSlot.findMany({
    where,
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

  const b = await db.barber.findFirst({ where: { userId: req.auth!.id } });

  const block = await db.blockedSlot.create({
    data: {
      organizationId: req.auth!.organizationId!,
      barberId: b?.id || null,
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
  const b = await db.barber.findFirst({ where: { userId: req.auth!.id } });

  await db.blockedSlot.deleteMany({
    where: {
      organizationId: req.auth!.organizationId!,
      barberId: b?.id || null,
      startsAt: { gte: startsAt },
      endsAt: { lte: endsAt }
    }
  });

  const block = await db.blockedSlot.create({
    data: {
      organizationId: req.auth!.organizationId!,
      barberId: b?.id || null,
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
  const b = await db.barber.findFirst({ where: { userId: req.auth!.id } });

  await db.blockedSlot.deleteMany({
    where: {
      organizationId: req.auth!.organizationId!,
      barberId: b?.id || null,
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

// 7. CLIENTES Y VIP
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
  const b = await db.barber.findFirst({ where: { userId: req.auth!.id } });
  const where: any = { organizationId: req.auth!.organizationId! };
  if (b) where.barberId = b.id;

  const vips = await db.vipSchedule.findMany({
    where,
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

  const barber = await db.barber.findFirst({ where: { userId: req.auth!.id } }) ||
                 await db.barber.findFirst({ where: { organizationId: req.auth!.organizationId! } });
  if (!barber) return fail(res, 404, 'BARBER_NOT_FOUND', 'Barbero no encontrado.');

  const existingVip = await db.vipSchedule.findFirst({
    where: {
      barberId: barber.id,
      weekday: v.weekday,
      time: v.time,
      active: true
    },
    include: { client: true }
  });

  if (existingVip) {
    return fail(res, 409, 'VIP_SLOT_TAKEN', `Este horario ya está asignado a otro VIP (${existingVip.client?.name || 'Cliente registrado'}).`);
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
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

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
app.post('/api/superadmin/upload', auth, role(Role.SUPERADMIN), upload.single('logo'), (req: Request, res: Response) => {
  if (!req.file) return fail(res, 400, 'NO_FILE', 'No se ha subido ningún archivo.');
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, data: { url: fileUrl } });
});

app.get('/api/superadmin/stats', auth, role(Role.SUPERADMIN), asyncRoute(async (_q, res) => {
  const [total, active, suspended, totalBarbers, totalAppointments, totalClients] = await Promise.all([
    db.organization.count(),
    db.organization.count({ where: { status: OrganizationStatus.ACTIVE } }),
    db.organization.count({ where: { status: OrganizationStatus.SUSPENDED } }),
    db.barber.count(),
    db.appointment.count(),
    db.client.count()
  ]);
  res.json({
    success: true,
    data: {
      totalOrganizations: total,
      active,
      suspended,
      expiringSoon: await db.organization.count({ where: { subscriptionExpiresAt: { lte: new Date(Date.now() + 7 * 864e5), gt: new Date() } } }),
      totalBarbers,
      totalAppointments,
      totalClients
    }
  });
}));

app.get('/api/superadmin/organizations', auth, role(Role.SUPERADMIN), asyncRoute(async (_q, res) => {
  const orgs = await db.organization.findMany({
    include: {
      _count: { select: { barbers: true, appointments: true, clients: true } },
      barbers: { select: { id: true, displayName: true, priority: true } },
      allowedBarbers: { orderBy: { priority: 'asc' } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, data: orgs });
}));

app.post('/api/superadmin/organizations', auth, role(Role.SUPERADMIN), asyncRoute(async (req, res) => {
  const v = z.object({
    name: z.string().min(2),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    logoUrl: z.string().optional().or(z.literal('')),
    maxBarbers: z.number().int().min(1).max(50).default(5),
    barbers: z.array(z.object({
      name: z.string().min(2),
      phone: z.string().min(7),
      priority: z.number().int().default(1)
    })).optional().default([])
  }).parse(req.body);

  const defaultExpiry = new Date('2099-12-31T23:59:59Z');

  const org = await db.organization.create({
    data: {
      name: v.name,
      slug: v.slug,
      logoUrl: v.logoUrl || null,
      subscriptionExpiresAt: defaultExpiry,
      maxBarbers: v.maxBarbers
    }
  });

  if (v.barbers.length > 0) {
    for (const b of v.barbers) {
      let cleanPhone = b.phone.replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) cleanPhone = `57${cleanPhone}`;
      await db.allowedBarber.create({
        data: {
          organizationId: org.id,
          name: b.name,
          phone: cleanPhone,
          priority: b.priority
        }
      });
    }
  }

  await db.service.createMany({
    data: [
      { organizationId: org.id, name: 'Corte Clásico', price: 25000, durationMinutes: 45 },
      { organizationId: org.id, name: 'Corte + Barba', price: 35000, durationMinutes: 60 },
      { organizationId: org.id, name: 'Barba / Perfilado', price: 18000, durationMinutes: 30 }
    ]
  });

  res.status(201).json({ success: true, data: org });
}));

app.patch('/api/superadmin/organizations/:id', auth, role(Role.SUPERADMIN), asyncRoute(async (req, res) => {
  const v = z.object({
    name: z.string().min(2).optional(),
    logoUrl: z.string().optional().nullable(),
    status: z.nativeEnum(OrganizationStatus).optional(),
    maxBarbers: z.number().int().min(1).max(50).optional()
  }).parse(req.body);

  const org = await db.organization.update({
    where: { id: String(req.params.id) },
    data: v
  });
  res.json({ success: true, data: org });
}));

app.post('/api/superadmin/organizations/:id/barbers', auth, role(Role.SUPERADMIN), asyncRoute(async (req, res) => {
  const v = z.object({
    name: z.string().min(2),
    phone: z.string().min(7),
    priority: z.number().int().default(1)
  }).parse(req.body);

  let cleanPhone = v.phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) cleanPhone = `57${cleanPhone}`;
  const orgId = String(req.params.id);

  const allowed = await db.allowedBarber.upsert({
    where: { organizationId_phone: { organizationId: orgId, phone: cleanPhone } },
    update: { name: v.name, priority: v.priority },
    create: {
      organizationId: orgId,
      name: v.name,
      phone: cleanPhone,
      priority: v.priority
    }
  });

  const existingUser = await db.user.findFirst({
    where: { organizationId: orgId, phone: cleanPhone },
    include: { barber: true }
  });
  if (existingUser?.barber) {
    await db.barber.update({
      where: { id: existingUser.barber.id },
      data: { priority: v.priority, displayName: v.name }
    });
  }

  res.status(201).json({ success: true, data: allowed });
}));

app.delete('/api/superadmin/organizations/:id/barbers/:barberId', auth, role(Role.SUPERADMIN), asyncRoute(async (req, res) => {
  const barberId = String(req.params.barberId);
  await db.allowedBarber.deleteMany({ where: { id: barberId } });
  res.json({ success: true });
}));

app.use((err: any, _q: Request, res: Response, _n: NextFunction) => {
  if (err instanceof z.ZodError) return fail(res, 422, 'VALIDATION_ERROR', err.issues.map(x => x.message).join(', '));
  console.error(err);
  return fail(res, 500, 'INTERNAL_ERROR', err.message || 'Ocurrió un error inesperado.');
});

app.listen(PORT, () => console.log(`ASYS API on :${PORT}`));