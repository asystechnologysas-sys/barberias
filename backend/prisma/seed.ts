import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('AsysDemo2026!', 12);

  // 1. Crear Organización
  const org = await db.organization.upsert({
    where: { slug: 'asysbarber' },
    update: {},
    create: {
      name: 'ASYS Barber',
      slug: 'asysbarber',
      description: 'Agenda tu estilo, a tu ritmo.',
      subscriptionExpiresAt: new Date('2030-01-01'),
    },
  });

  // 2. Superadmin
  await db.user.upsert({
    where: { email: 'admin@asys.local' },
    update: {},
    create: {
      name: 'ASYS Admin',
      email: 'admin@asys.local',
      passwordHash: hash,
      role: Role.SUPERADMIN,
    },
  });

  // 3. Dueño (Owner)
  await db.user.upsert({
    where: { email: 'owner@asysbarber.local' },
    update: {},
    create: {
      name: 'Dueño ASYS',
      email: 'owner@asysbarber.local',
      organizationId: org.id,
      passwordHash: hash,
      role: Role.OWNER,
    },
  });

  // 4. Barberos y sus Horarios
  const barberRecords = [];
  for (const name of ['Carlos Rojas', 'Mateo León']) {
    const email = name.toLowerCase().replace(' ', '@') + 'asys.local';
    const u = await db.user.upsert({
      where: { email },
      update: {},
      create: {
        name,
        email,
        organizationId: org.id,
        passwordHash: hash,
        role: Role.BARBER,
      },
    });

    const b = await db.barber.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        organizationId: org.id,
        userId: u.id,
        displayName: name,
      },
    });
    barberRecords.push(b);
  }

  // 5. Horarios de atención asignados a cada barbero
  for (const barber of barberRecords) {
    for (let day = 0; day < 7; day++) {
      await db.daySchedule.upsert({
        where: {
          organizationId_barberId_weekday: {
            organizationId: org.id,
            barberId: barber.id,
            weekday: day,
          },
        },
        update: {},
        create: {
          organizationId: org.id,
          barberId: barber.id,
          weekday: day,
          openTime: '09:00',
          closeTime: '19:00',
          breakStart: '13:00',
          breakEnd: '14:00',
          closed: day === 0, // Domingo cerrado
        },
      });
    }
  }

  // 6. Cliente Demo
  const clientU = await db.user.upsert({
    where: { email: 'cliente@asysbarber.local' },
    update: {},
    create: {
      name: 'Cliente Demo',
      email: 'cliente@asysbarber.local',
      organizationId: org.id,
      passwordHash: hash,
      role: Role.CLIENT,
    },
  });

  await db.client.upsert({
    where: { userId: clientU.id },
    update: {},
    create: {
      organizationId: org.id,
      userId: clientU.id,
      name: 'Cliente Demo',
      phone: '+573000000000',
      verifiedAt: new Date(),
    },
  });

  // 7. Servicios
  const services = [
    ['Corte', 25000, 45],
    ['Corte + Barba', 40000, 75],
    ['Barba', 18000, 30],
  ] as const;

  for (const [name, price, durationMinutes] of services) {
    await db.service.upsert({
      where: { id: 'seed-' + name },
      update: {},
      create: {
        id: 'seed-' + name,
        organizationId: org.id,
        name,
        price,
        durationMinutes,
      },
    });
  }

  console.log('✅ Seed completado con éxito. Password: AsysDemo2026!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());