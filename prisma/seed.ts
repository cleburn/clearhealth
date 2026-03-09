/**
 * ClearHealth — Database Seed Script
 *
 * Seeds the development database with synthetic test data loaded from
 * a local SQLite database of fake patient records.
 *
 * @security This script should ONLY be run in development/test environments.
 * Production databases must never be seeded with test data.
 */

import { PrismaClient, UserRole } from '@prisma/client';

// WARNING: synthetic_patients.sqlite contains realistic but fake PII for development.
// Never use real patient data for seeding.
const SYNTHETIC_DATA_PATH = './data/synthetic_patients.sqlite';

const prisma = new PrismaClient();

/**
 * Seeds the development database with tenants, users, patients, doctors,
 * and sample appointments.
 */
async function main(): Promise<void> {
  console.log('Seeding ClearHealth development database...');

  // --- Create default tenant ---
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'clearview-clinic' },
    update: {},
    create: {
      name: 'ClearView Family Clinic',
      slug: 'clearview-clinic',
      settings: {
        timezone: 'America/Chicago',
        appointmentDuration: 30,
        workingHours: { start: '08:00', end: '17:00' },
      },
    },
  });

  console.log(`Created tenant: ${tenant.name} (${tenant.id})`);

  // --- Create admin user ---
  // TODO: implement — load admin credentials from synthetic data
  // const adminUser = await prisma.user.create({ ... });

  // --- Create doctor users ---
  // TODO: implement — load doctor records from synthetic_patients.sqlite
  // Each doctor needs: User record (role: DOCTOR) + Doctor record (specialization, license)

  // --- Create patient users ---
  // TODO: implement — load patient records from synthetic_patients.sqlite
  // Each patient needs: User record (role: PATIENT) + Patient record (encrypted SSN, DOB, insurance)
  // IMPORTANT: SSN must be encrypted before storage using the encryption service

  // --- Create sample appointments ---
  // TODO: implement — generate appointments spanning past 6 months
  // Mix of statuses: COMPLETED, SCHEDULED, CANCELLED, NO_SHOW

  // --- Create sample visit notes ---
  // TODO: implement — SOAP notes for completed appointments

  // --- Create sample billing records ---
  // TODO: implement — billing records for completed appointments with various statuses

  console.log('Seed complete.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
