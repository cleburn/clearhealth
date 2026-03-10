/**
 * ClearHealth — Database Seed Script
 *
 * Seeds the development database with synthetic test data for two tenants,
 * demonstrating multi-tenancy with full data isolation.
 *
 * @security This script should ONLY be run in development/test environments.
 * Production databases must never be seeded with test data.
 */

import {
  Prisma,
  PrismaClient,
  UserRole,
  AppointmentStatus,
  AppointmentType,
  BillingStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Synthetic placeholder password hash (bcrypt-style, NOT a real hash)
// ---------------------------------------------------------------------------
const PLACEHOLDER_HASH =
  '$2b$12$SyntheticPlaceholderHashForDevSeedOnly00000000000000000';

// ---------------------------------------------------------------------------
// Helper: fake encrypted SSN (placeholder format)
// ---------------------------------------------------------------------------
function fakeEncryptedSsn(index: number): string {
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  return `encrypted:${hex(index)}iv:${hex(index + 100)}tag:${hex(index + 200)}cipher`;
}

// ---------------------------------------------------------------------------
// Helper: deterministic date N months ago at a given hour
// ---------------------------------------------------------------------------
function monthsAgo(n: number, day = 15, hour = 10): Date {
  const d = new Date('2026-03-09T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - n);
  d.setUTCDate(day);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Synthetic doctor data (per tenant)
// ---------------------------------------------------------------------------
interface DoctorSeed {
  firstName: string;
  lastName: string;
  email: string;
  specialization: string;
  licenseNumber: string;
}

const DOCTORS_TENANT_1: DoctorSeed[] = [
  {
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah.chen@clearview.dev',
    specialization: 'Family Medicine',
    licenseNumber: 'TX-FM-100201',
  },
  {
    firstName: 'James',
    lastName: 'Okafor',
    email: 'james.okafor@clearview.dev',
    specialization: 'Internal Medicine',
    licenseNumber: 'TX-IM-100302',
  },
];

const DOCTORS_TENANT_2: DoctorSeed[] = [
  {
    firstName: 'Maria',
    lastName: 'Gonzalez',
    email: 'maria.gonzalez@riverside.dev',
    specialization: 'Pediatrics',
    licenseNumber: 'TX-PD-200401',
  },
  {
    firstName: 'David',
    lastName: 'Park',
    email: 'david.park@riverside.dev',
    specialization: 'Cardiology',
    licenseNumber: 'TX-CD-200502',
  },
];

// ---------------------------------------------------------------------------
// Synthetic patient data (per tenant)
// ---------------------------------------------------------------------------
interface PatientSeed {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: Date;
  mrn: string;
  insuranceId: string;
  insurancePlan: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

const PATIENTS_TENANT_1: PatientSeed[] = [
  {
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice.johnson@example.dev',
    phone: '555-0101',
    dob: new Date('1985-03-12'),
    mrn: 'MRN-10001',
    insuranceId: 'BC-001-A',
    insurancePlan: 'Blue Cross PPO',
    emergencyContactName: 'Bob Johnson',
    emergencyContactPhone: '555-0102',
  },
  {
    firstName: 'Carlos',
    lastName: 'Rivera',
    email: 'carlos.rivera@example.dev',
    phone: '555-0201',
    dob: new Date('1972-07-24'),
    mrn: 'MRN-10002',
    insuranceId: 'AE-002-C',
    insurancePlan: 'Aetna HMO',
    emergencyContactName: 'Diana Rivera',
    emergencyContactPhone: '555-0202',
  },
  {
    firstName: 'Emily',
    lastName: 'Tran',
    email: 'emily.tran@example.dev',
    phone: '555-0301',
    dob: new Date('1990-11-05'),
    mrn: 'MRN-10003',
    insuranceId: 'UN-003-E',
    insurancePlan: 'UnitedHealth Choice',
    emergencyContactName: 'Frank Tran',
    emergencyContactPhone: '555-0302',
  },
  {
    firstName: 'George',
    lastName: 'Williams',
    email: 'george.williams@example.dev',
    phone: '555-0401',
    dob: new Date('1968-01-30'),
    mrn: 'MRN-10004',
    insuranceId: 'CG-004-G',
    insurancePlan: 'Cigna Open Access',
    emergencyContactName: 'Helen Williams',
    emergencyContactPhone: '555-0402',
  },
];

const PATIENTS_TENANT_2: PatientSeed[] = [
  {
    firstName: 'Fatima',
    lastName: 'Al-Rashid',
    email: 'fatima.alrashid@example.dev',
    phone: '555-0501',
    dob: new Date('1995-06-18'),
    mrn: 'MRN-20001',
    insuranceId: 'BC-005-F',
    insurancePlan: 'Blue Cross EPO',
    emergencyContactName: 'Omar Al-Rashid',
    emergencyContactPhone: '555-0502',
  },
  {
    firstName: 'Kevin',
    lastName: 'Nguyen',
    email: 'kevin.nguyen@example.dev',
    phone: '555-0601',
    dob: new Date('1982-09-03'),
    mrn: 'MRN-20002',
    insuranceId: 'KP-006-K',
    insurancePlan: 'Kaiser Permanente',
    emergencyContactName: 'Lisa Nguyen',
    emergencyContactPhone: '555-0602',
  },
  {
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@example.dev',
    phone: '555-0701',
    dob: new Date('1978-12-22'),
    mrn: 'MRN-20003',
    insuranceId: 'AE-007-P',
    insurancePlan: 'Aetna PPO',
    emergencyContactName: 'Ravi Sharma',
    emergencyContactPhone: '555-0702',
  },
  {
    firstName: 'Marcus',
    lastName: 'Brown',
    email: 'marcus.brown@example.dev',
    phone: '555-0801',
    dob: new Date('1999-04-11'),
    mrn: 'MRN-20004',
    insuranceId: 'UN-008-M',
    insurancePlan: 'UnitedHealth Select',
    emergencyContactName: 'Nina Brown',
    emergencyContactPhone: '555-0802',
  },
];

// ---------------------------------------------------------------------------
// SOAP note templates for completed visits
// ---------------------------------------------------------------------------
interface SoapTemplate {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  cptCodes: string[];
  icdCodes: string[];
  amount: string;
}

const SOAP_TEMPLATES: SoapTemplate[] = [
  {
    subjective:
      'Patient reports persistent cough for 5 days with mild sore throat. Denies fever or shortness of breath. No known sick contacts.',
    objective:
      'Vitals: T 98.4F, BP 122/78, HR 72, RR 16, SpO2 98%. Oropharynx mildly erythematous. Lungs clear bilaterally. No cervical lymphadenopathy.',
    assessment: 'Acute upper respiratory infection, uncomplicated.',
    plan: 'Supportive care with rest and fluids. OTC acetaminophen for discomfort. Return if symptoms worsen or fever develops. Follow up in 7 days if not improved.',
    cptCodes: ['99213'],
    icdCodes: ['J06.9'],
    amount: '150.00',
  },
  {
    subjective:
      'Patient presents for follow-up of hypertension. Reports compliance with lisinopril 10mg daily. Occasional headaches in the morning. No chest pain or palpitations.',
    objective:
      'Vitals: BP 138/86, HR 68, RR 14. Weight stable at 185 lbs. Heart regular rate and rhythm, no murmurs. Lungs clear.',
    assessment: 'Essential hypertension, not adequately controlled on current regimen.',
    plan: 'Increase lisinopril to 20mg daily. Low-sodium diet counseling provided. Recheck BP in 4 weeks. Basic metabolic panel ordered.',
    cptCodes: ['99214'],
    icdCodes: ['I10'],
    amount: '200.00',
  },
  {
    subjective:
      'Patient reports low back pain for 2 weeks after lifting heavy boxes. Pain is dull, worsens with prolonged sitting. Rates pain 5/10. No radiation to legs.',
    objective:
      'Vitals stable. Lumbar ROM limited by pain. Straight leg raise negative bilaterally. No neurological deficits. Paraspinal tenderness at L4-L5.',
    assessment: 'Lumbar strain, acute. No red flags for serious pathology.',
    plan: 'Ibuprofen 400mg TID with food for 10 days. Gentle stretching exercises demonstrated. Avoid heavy lifting for 2 weeks. Physical therapy referral if not improved in 3 weeks.',
    cptCodes: ['99213'],
    icdCodes: ['M54.5'],
    amount: '150.00',
  },
  {
    subjective:
      'Annual wellness visit. Patient reports feeling well overall. No new complaints. Exercises 3x/week. Non-smoker. Moderate alcohol use (2-3 drinks/week).',
    objective:
      'Vitals: BP 118/72, HR 66, RR 14, BMI 24.2. General exam unremarkable. Cardiovascular, respiratory, abdominal exams normal. Skin clear.',
    assessment: 'Routine adult health maintenance. Age-appropriate screening up to date.',
    plan: 'Continue current healthy lifestyle. Updated immunizations per schedule. Lipid panel and CBC ordered for routine screening. Return in 12 months or sooner if concerns.',
    cptCodes: ['99395'],
    icdCodes: ['Z00.00'],
    amount: '250.00',
  },
  {
    subjective:
      'Patient reports fatigue and increased thirst over the past month. Frequent urination, especially at night. Family history of type 2 diabetes (mother).',
    objective:
      'Vitals: BP 130/82, HR 74, BMI 29.8. Fasting glucose 142 mg/dL (H). A1C 7.1% (H). Skin intact, no acanthosis nigricans. Pedal pulses intact.',
    assessment: 'New diagnosis of type 2 diabetes mellitus.',
    plan: 'Start metformin 500mg BID with meals. Diabetic education referral. Dietary counseling for carbohydrate management. Ophthalmology referral for baseline diabetic eye exam. Follow-up in 3 months with repeat A1C.',
    cptCodes: ['99214', '99401'],
    icdCodes: ['E11.9'],
    amount: '275.00',
  },
  {
    subjective:
      'Patient presents with sinus congestion, facial pressure, and yellow-green nasal discharge for 10 days. Previous viral URI 2 weeks ago that initially improved then worsened.',
    objective:
      'Vitals: T 99.8F, BP 120/76. Tenderness to palpation over maxillary sinuses bilaterally. Purulent drainage in posterior oropharynx. TMs clear. No cervical lymphadenopathy.',
    assessment: 'Acute bacterial sinusitis.',
    plan: 'Amoxicillin-clavulanate 875mg BID for 10 days. Nasal saline irrigation. OTC decongestant for symptom relief. Return if no improvement in 72 hours.',
    cptCodes: ['99213'],
    icdCodes: ['J01.90'],
    amount: '150.00',
  },
  {
    subjective:
      'Patient reports intermittent knee pain with swelling after exercise. Worse going downstairs. No locking or giving way. Active runner, 20 miles/week.',
    objective:
      'Vitals stable. Right knee: mild effusion, no warmth. Positive patellar grind test. McMurray test negative. Ligaments stable. Full ROM with crepitus.',
    assessment: 'Patellofemoral syndrome, right knee.',
    plan: 'Activity modification: reduce running to 10 miles/week temporarily. Quadriceps strengthening exercises prescribed. Ice after activity. NSAID PRN. Physical therapy referral. Follow up in 6 weeks.',
    cptCodes: ['99214'],
    icdCodes: ['M22.2E9'],
    amount: '200.00',
  },
];

// ---------------------------------------------------------------------------
// Appointment status distribution for the seed
// ---------------------------------------------------------------------------
const APPOINTMENT_CONFIGS: Array<{
  monthsBack: number;
  day: number;
  hour: number;
  status: AppointmentStatus;
  type: AppointmentType;
}> = [
  // Completed appointments (oldest first)
  { monthsBack: 6, day: 5, hour: 9, status: 'COMPLETED', type: 'INITIAL' },
  { monthsBack: 6, day: 12, hour: 11, status: 'COMPLETED', type: 'INITIAL' },
  { monthsBack: 5, day: 3, hour: 10, status: 'COMPLETED', type: 'FOLLOW_UP' },
  { monthsBack: 5, day: 18, hour: 14, status: 'COMPLETED', type: 'INITIAL' },
  { monthsBack: 4, day: 7, hour: 9, status: 'COMPLETED', type: 'FOLLOW_UP' },
  { monthsBack: 4, day: 22, hour: 15, status: 'COMPLETED', type: 'URGENT' },
  { monthsBack: 3, day: 2, hour: 10, status: 'COMPLETED', type: 'TELEHEALTH' },
  { monthsBack: 3, day: 15, hour: 11, status: 'COMPLETED', type: 'FOLLOW_UP' },
  { monthsBack: 2, day: 8, hour: 9, status: 'COMPLETED', type: 'INITIAL' },
  { monthsBack: 2, day: 20, hour: 14, status: 'COMPLETED', type: 'FOLLOW_UP' },
  { monthsBack: 1, day: 5, hour: 10, status: 'COMPLETED', type: 'FOLLOW_UP' },
  { monthsBack: 1, day: 14, hour: 13, status: 'COMPLETED', type: 'URGENT' },
  // Cancelled / No-show
  { monthsBack: 4, day: 10, hour: 10, status: 'CANCELLED', type: 'FOLLOW_UP' },
  { monthsBack: 3, day: 20, hour: 9, status: 'NO_SHOW', type: 'FOLLOW_UP' },
  { monthsBack: 1, day: 22, hour: 11, status: 'CANCELLED', type: 'TELEHEALTH' },
  // Upcoming / in-progress
  { monthsBack: 0, day: 9, hour: 9, status: 'IN_PROGRESS', type: 'FOLLOW_UP' },
  { monthsBack: 0, day: 9, hour: 11, status: 'CONFIRMED', type: 'INITIAL' },
  { monthsBack: 0, day: 10, hour: 10, status: 'SCHEDULED', type: 'FOLLOW_UP' },
  { monthsBack: 0, day: 12, hour: 14, status: 'SCHEDULED', type: 'TELEHEALTH' },
];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('Seeding ClearHealth development database...');

  // -----------------------------------------------------------------------
  // 1. Create tenants
  // -----------------------------------------------------------------------
  const tenant1 = await prisma.tenant.upsert({
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

  const tenant2 = await prisma.tenant.upsert({
    where: { slug: 'riverside-medical' },
    update: {},
    create: {
      name: 'Riverside Medical Group',
      slug: 'riverside-medical',
      settings: {
        timezone: 'America/New_York',
        appointmentDuration: 30,
        workingHours: { start: '07:30', end: '16:30' },
      },
    },
  });

  console.log(`Tenant: ${tenant1.name} (${tenant1.id})`);
  console.log(`Tenant: ${tenant2.name} (${tenant2.id})`);

  // -----------------------------------------------------------------------
  // 2. Create admin users (1 per tenant)
  // -----------------------------------------------------------------------
  const admin1 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'admin@clearview.dev' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      email: 'admin@clearview.dev',
      passwordHash: PLACEHOLDER_HASH,
      role: UserRole.ADMIN,
      firstName: 'Linda',
      lastName: 'Martinez',
      phone: '555-0001',
    },
  });

  const admin2 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant2.id, email: 'admin@riverside.dev' } },
    update: {},
    create: {
      tenantId: tenant2.id,
      email: 'admin@riverside.dev',
      passwordHash: PLACEHOLDER_HASH,
      role: UserRole.ADMIN,
      firstName: 'Robert',
      lastName: 'Kim',
      phone: '555-0002',
    },
  });

  console.log(`Admin: ${admin1.firstName} ${admin1.lastName} (${tenant1.name})`);
  console.log(`Admin: ${admin2.firstName} ${admin2.lastName} (${tenant2.name})`);

  // -----------------------------------------------------------------------
  // 3. Create doctor users + Doctor records
  // -----------------------------------------------------------------------
  async function seedDoctor(
    tenantId: string,
    seed: DoctorSeed,
  ): Promise<{ userId: string; doctorId: string }> {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: seed.email } },
      update: {},
      create: {
        tenantId,
        email: seed.email,
        passwordHash: PLACEHOLDER_HASH,
        role: UserRole.DOCTOR,
        firstName: seed.firstName,
        lastName: seed.lastName,
      },
    });

    const doctor = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        specialization: seed.specialization,
        licenseNumber: seed.licenseNumber,
        scheduleConfig: {
          monday: { start: '08:00', end: '17:00', slotDuration: 30 },
          tuesday: { start: '08:00', end: '17:00', slotDuration: 30 },
          wednesday: { start: '08:00', end: '17:00', slotDuration: 30 },
          thursday: { start: '08:00', end: '17:00', slotDuration: 30 },
          friday: { start: '08:00', end: '12:00', slotDuration: 30 },
        },
      },
    });

    console.log(`Doctor: Dr. ${seed.firstName} ${seed.lastName} — ${seed.specialization}`);
    return { userId: user.id, doctorId: doctor.id };
  }

  const t1Doctors = await Promise.all(
    DOCTORS_TENANT_1.map((d) => seedDoctor(tenant1.id, d)),
  );
  const t2Doctors = await Promise.all(
    DOCTORS_TENANT_2.map((d) => seedDoctor(tenant2.id, d)),
  );

  // -----------------------------------------------------------------------
  // 4. Create patient users + Patient records
  // -----------------------------------------------------------------------
  async function seedPatient(
    tenantId: string,
    seed: PatientSeed,
    index: number,
  ): Promise<{ userId: string; patientId: string }> {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: seed.email } },
      update: {},
      create: {
        tenantId,
        email: seed.email,
        passwordHash: PLACEHOLDER_HASH,
        role: UserRole.PATIENT,
        firstName: seed.firstName,
        lastName: seed.lastName,
        phone: seed.phone,
      },
    });

    const patient = await prisma.patient.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        dateOfBirth: seed.dob,
        ssn: fakeEncryptedSsn(index),
        insuranceId: seed.insuranceId,
        insurancePlan: seed.insurancePlan,
        medicalRecordNumber: seed.mrn,
        emergencyContactName: seed.emergencyContactName,
        emergencyContactPhone: seed.emergencyContactPhone,
        notes: null,
      },
    });

    console.log(`Patient: ${seed.firstName} ${seed.lastName} (${seed.mrn})`);
    return { userId: user.id, patientId: patient.id };
  }

  const t1Patients = await Promise.all(
    PATIENTS_TENANT_1.map((p, i) => seedPatient(tenant1.id, p, i + 1)),
  );
  const t2Patients = await Promise.all(
    PATIENTS_TENANT_2.map((p, i) => seedPatient(tenant2.id, p, i + 5)),
  );

  // -----------------------------------------------------------------------
  // 5. Create appointments across both tenants
  // -----------------------------------------------------------------------
  interface CreatedAppointment {
    id: string;
    tenantId: string;
    patientId: string;
    doctorId: string;
    status: AppointmentStatus;
  }

  const allAppointments: CreatedAppointment[] = [];

  // Tenant 1 appointments
  for (let i = 0; i < APPOINTMENT_CONFIGS.length; i++) {
    const cfg = APPOINTMENT_CONFIGS[i];
    const patientIdx = i % t1Patients.length;
    const doctorIdx = i % t1Doctors.length;
    const scheduledAt = monthsAgo(cfg.monthsBack, cfg.day, cfg.hour);

    const appt = await prisma.appointment.create({
      data: {
        tenantId: tenant1.id,
        patientId: t1Patients[patientIdx].patientId,
        doctorId: t1Doctors[doctorIdx].doctorId,
        scheduledAt,
        duration: 30,
        status: cfg.status,
        type: cfg.type,
        notes: cfg.status === 'CANCELLED' ? 'Patient requested cancellation.' : null,
      },
    });

    allAppointments.push({
      id: appt.id,
      tenantId: tenant1.id,
      patientId: t1Patients[patientIdx].patientId,
      doctorId: t1Doctors[doctorIdx].doctorId,
      status: cfg.status,
    });
  }

  // Tenant 2 appointments (subset — ~12 appointments)
  const t2Configs = APPOINTMENT_CONFIGS.slice(0, 12);
  for (let i = 0; i < t2Configs.length; i++) {
    const cfg = t2Configs[i];
    const patientIdx = i % t2Patients.length;
    const doctorIdx = i % t2Doctors.length;
    const scheduledAt = monthsAgo(cfg.monthsBack, cfg.day + 1, cfg.hour);

    const appt = await prisma.appointment.create({
      data: {
        tenantId: tenant2.id,
        patientId: t2Patients[patientIdx].patientId,
        doctorId: t2Doctors[doctorIdx].doctorId,
        scheduledAt,
        duration: 30,
        status: cfg.status,
        type: cfg.type,
        notes: null,
      },
    });

    allAppointments.push({
      id: appt.id,
      tenantId: tenant2.id,
      patientId: t2Patients[patientIdx].patientId,
      doctorId: t2Doctors[doctorIdx].doctorId,
      status: cfg.status,
    });
  }

  console.log(`Created ${allAppointments.length} appointments across both tenants.`);

  // -----------------------------------------------------------------------
  // 6. Create visit notes for COMPLETED appointments (SOAP format)
  // -----------------------------------------------------------------------
  const completedAppts = allAppointments.filter((a) => a.status === 'COMPLETED');
  let visitNoteCount = 0;

  for (let i = 0; i < completedAppts.length; i++) {
    const appt = completedAppts[i];
    const template = SOAP_TEMPLATES[i % SOAP_TEMPLATES.length];

    await prisma.visitNote.create({
      data: {
        appointmentId: appt.id,
        doctorId: appt.doctorId,
        subjective: template.subjective,
        objective: template.objective,
        assessment: template.assessment,
        plan: template.plan,
        isSigned: true,
        signedAt: new Date(),
      },
    });
    visitNoteCount++;
  }

  console.log(`Created ${visitNoteCount} visit notes for completed appointments.`);

  // -----------------------------------------------------------------------
  // 7. Create billing records for COMPLETED appointments
  // -----------------------------------------------------------------------
  const billingStatuses: BillingStatus[] = [
    'PAID',
    'APPROVED',
    'SUBMITTED',
    'PENDING',
    'DENIED',
  ];
  let billingCount = 0;

  for (let i = 0; i < completedAppts.length; i++) {
    const appt = completedAppts[i];
    const template = SOAP_TEMPLATES[i % SOAP_TEMPLATES.length];
    const billingStatus = billingStatuses[i % billingStatuses.length];

    await prisma.billingRecord.create({
      data: {
        tenantId: appt.tenantId,
        appointmentId: appt.id,
        patientId: appt.patientId,
        amount: new Decimal(template.amount),
        status: billingStatus,
        cptCodes: template.cptCodes,
        icdCodes: template.icdCodes,
        insuranceClaim:
          billingStatus !== 'PENDING'
            ? {
                claimId: `CLM-${(1000 + i).toString()}`,
                submittedAt: new Date().toISOString(),
                payerId: 'SYNTH-PAYER-001',
              }
            : Prisma.JsonNull,
      },
    });
    billingCount++;
  }

  console.log(`Created ${billingCount} billing records.`);

  // -----------------------------------------------------------------------
  // 8. Create insurance verification records
  // -----------------------------------------------------------------------
  const allPatients = [...t1Patients, ...t2Patients];
  const verificationStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'PENDING', 'ACTIVE', 'ACTIVE', 'EXPIRED', 'ACTIVE'];
  let verificationCount = 0;

  for (let i = 0; i < allPatients.length; i++) {
    const patient = allPatients[i];
    const status = verificationStatuses[i % verificationStatuses.length];
    const verifiedAt = monthsAgo(1, 1, 12);
    const expiresAt = new Date('2026-09-01T00:00:00Z');

    await prisma.insuranceVerification.create({
      data: {
        patientId: patient.patientId,
        verifiedAt,
        status,
        expiresAt: status === 'EXPIRED' ? monthsAgo(0, 1, 0) : expiresAt,
        response: {
          verified: status === 'ACTIVE',
          memberId: `SYNTH-MBR-${(i + 1).toString().padStart(3, '0')}`,
          groupNumber: `GRP-${(100 + i).toString()}`,
          copay: 25,
          deductible: 1500,
          deductibleMet: i % 2 === 0 ? 1200 : 400,
          outOfPocketMax: 6000,
        },
      },
    });
    verificationCount++;
  }

  console.log(`Created ${verificationCount} insurance verification records.`);

  // -----------------------------------------------------------------------
  // 9. Create sample audit log entries
  // -----------------------------------------------------------------------
  await prisma.auditLog.create({
    data: {
      tenantId: tenant1.id,
      userId: admin1.id,
      action: 'LOGIN',
      resource: 'session',
      resourceId: null,
      metadata: { method: 'password' },
      ipAddress: '192.168.1.100',
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant2.id,
      userId: admin2.id,
      action: 'LOGIN',
      resource: 'session',
      resourceId: null,
      metadata: { method: 'password' },
      ipAddress: '192.168.1.200',
    },
  });

  console.log('Created sample audit log entries.');
  console.log('Seed complete.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e: unknown) => {
    console.error('Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
