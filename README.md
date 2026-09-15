# ASYS Barber

MVP SaaS multi-tenant para barberías: portal público, agenda, clientes, roles, VIP, suscripciones, notificaciones n8n y operación administrativa. Usa un monolito modular Node/Express + React/Vite + PostgreSQL; es intencionalmente simple de desplegar en EasyPanel.

## Arquitectura

```text
React/Vite (portal, cliente y dashboards)
                 │ REST + cookies JWT
Node.js / Express (módulos y middleware de tenant/rol)
                 │ Prisma + transacciones serializables
             PostgreSQL
                 │ webhooks HTTP salientes
                n8n → WhatsApp
```

**Decisiones clave:** Prisma ofrece migraciones, tipado y parámetros seguros sin añadir complejidad. Cada consulta privada deriva `organizationId` del JWT; nunca del body. Las rutas públicas derivan el tenant exclusivamente de `:slug`. Las reservas se validan dentro de una transacción serializable y el archivo `database/schema.sql` añade una exclusion constraint `tstzrange`, que es la protección final ante doble reserva concurrente.

## Estructura

```text
backend/       API Express, Prisma, seed y Dockerfile
frontend/      React/Vite, portal de reserva y dashboards
database/      constraint SQL de PostgreSQL para solapamientos
docker-compose.yml
```

## Inicio local

1. Copia `.env.example` como `.env` y ajusta `DATABASE_URL` y secretos.
2. Instala dependencias: `npm install`
3. Levanta PostgreSQL: `docker compose up -d postgres`
4. Genera y aplica esquema: `npm run db:generate`, `npm run db:migrate`
5. Aplica la constraint crítica: `psql "$DATABASE_URL" -f database/schema.sql`
6. Inserta datos de prueba: `npm run db:seed`
7. Inicia los dos servicios: `npm run dev`

Portal: `http://localhost:5173/b/asysbarber` · API health: `http://localhost:3000/api/health`.

Usuarios seed (contraseña: `AsysDemo2026!`): `admin@asys.local`, `owner@asysbarber.local`, `cliente@asysbarber.local`. Se crean también dos barberos.

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

En el primer despliegue ejecuta migraciones y seed desde el servicio backend; aplica una vez `database/schema.sql`. La constraint usa `btree_gist`, disponible en PostgreSQL estándar.

## EasyPanel

1. Crea un proyecto y una base PostgreSQL 16.
2. Crea servicio **backend** desde el repositorio, Dockerfile `backend/Dockerfile`, puerto `3000`.
3. Define `DATABASE_URL` usando la conexión interna, `JWT_SECRET` (64+ caracteres), `APP_URL`, `CORS_ORIGIN`, `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` y `CRON_SECRET`.
4. Crea servicio **frontend** con `frontend/Dockerfile`, puerto `80`; configura el dominio público allí. Si usa un dominio distinto para API, adapta el proxy/API URL antes de construir.
5. Ejecuta `npx prisma migrate deploy`, el seed y una vez `psql ... -f database/schema.sql` desde una consola conectada a PostgreSQL.
6. Configura los cron de EasyPanel a `/api/cron/reminders-24h` y `/api/cron/subscription-checks`, incluyendo `X-Cron-Secret`.
7. Comprueba `GET /api/health`.

## API principal

| Método | Ruta | Auth / rol | Uso |
|---|---|---|---|
| GET | `/api/health` | pública | Salud y PostgreSQL |
| GET | `/api/public/:slug` | pública | Portal, servicios y barberos |
| GET | `/api/public/:slug/availability` | pública | `date`, `serviceId`, `barberId?` |
| POST | `/api/auth/login` | pública | email/password; entrega cookie JWT |
| POST | `/api/auth/otp/request` | pública | slug/phone; n8n envía OTP |
| POST | `/api/auth/register` | pública | registro de cliente verificado |
| GET/POST | `/api/appointments` | client | lista/crea cita |
| PATCH | `/api/appointments/:id/cancel` | client/barber/owner | cancela cita scoped al tenant |
| GET/POST | `/api/services` | owner/barber, owner | consultar/crear servicios |
| GET/POST | `/api/barbers` | owner/barber, owner | consultar/crear barberos |
| POST | `/api/blocks` | owner/barber | bloquear franja |
| GET/POST | `/api/vip` | owner/barber | horarios recurrentes |
| POST | `/api/vip/:id/exceptions` | owner/barber | `SKIP` o `RESCHEDULE` |
| GET | `/api/superadmin/stats` | superadmin | KPIs globales |
| POST/PATCH | `/api/superadmin/organizations` | superadmin | crear/gestionar tenant |
| POST | `/api/webhooks/otp-request` | `X-Webhook-Secret` | receptor preparado n8n |
| POST | `/api/webhooks/booking-created` | `X-Webhook-Secret` | receptor preparado n8n |
| GET | `/api/cron/*` | `X-Cron-Secret` | recordatorios y suscripciones |

Todos los errores tienen la forma `{ success:false, error:{ code, message } }`. Las entradas se validan con Zod; no se exponen stack traces.

## Seguridad y reglas

- Passwords bcrypt (12 rounds), OTP hasheado, expira a 5 min, cinco intentos y rate limit.
- JWT HttpOnly (en producción Secure) y CORS/Helmet/rate limiting.
- `organizationId` se deriva de identidad/slug, no de datos suministrados por navegador.
- Límite de dos citas activas por cliente dentro de siete días.
- Los tenants suspendidos no acceden a portal, reservas ni login administrativo.
- `vip_schedules` y `vip_exceptions` representan recurrencia y cambios puntuales; una tarea de materialización puede crear las futuras reservas conforme crezca la ventana.

## Pruebas recomendadas

Verifica que un token de otro tenant no liste ni modifique registros, crea dos reservas simultáneas para el mismo barbero/intervalo, prueba la tercera reserva del cliente, prueba OTP vencido, y suspende la organización desde superadmin. Para concurrencia real, aplica siempre la exclusion constraint de `database/schema.sql`.
