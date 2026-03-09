/**
 * ClearHealth Web — Appointments Page
 *
 * Displays appointment list with filtering and booking capabilities.
 * - PATIENT: View own appointments, book new appointments
 * - DOCTOR: View assigned appointments, manage schedule
 * - ADMIN: View all clinic appointments, manage bookings
 *
 * @security Appointment data is tenant-scoped and role-filtered.
 */

'use client';

import type { Appointment, AppointmentStatus, AppointmentType } from '@clearhealth/shared/types/appointment';

export default function AppointmentsPage() {
  // TODO: implement
  // - Fetch appointments from API (filtered by role)
  // - Filter controls: date range, status, doctor, type
  // - Appointment list/calendar view toggle
  // - "Book Appointment" button (PATIENT, ADMIN)
  // - Click appointment -> detail view with actions (cancel, reschedule)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
          Book Appointment
        </button>
      </div>

      {/* TODO: implement appointment filters and list */}
      <div className="mt-6">
        <p className="text-gray-500">Loading appointments...</p>
      </div>
    </div>
  );
}
