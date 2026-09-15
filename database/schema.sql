-- Prisma owns the base schema. Apply this after Prisma migrations for race-safe appointments.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Appointment" ADD CONSTRAINT appointment_no_overlap
EXCLUDE USING gist ("barberId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&)
WHERE ("status" = 'CONFIRMED');
CREATE INDEX IF NOT EXISTS appointment_tenant_start_idx ON "Appointment" ("organizationId", "startsAt");
