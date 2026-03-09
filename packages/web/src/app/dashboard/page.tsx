/**
 * ClearHealth Web — Dashboard Page
 *
 * Main dashboard view after login. Content varies by user role:
 * - PATIENT: Upcoming appointments, recent visit notes, quick actions
 * - DOCTOR: Today's schedule, pending visit notes, patient queue
 * - ADMIN: Clinic overview, billing summary, staff status
 *
 * @security Dashboard data is tenant-scoped and role-filtered by the API.
 */

'use client';

import type { User } from '@clearhealth/shared/types/auth';

export default function DashboardPage() {
  // TODO: implement
  // - Fetch current user profile and role
  // - Render role-specific dashboard widgets:
  //   PATIENT: upcoming appointments, recent records
  //   DOCTOR: today's schedule, pending notes, patient queue
  //   ADMIN: clinic metrics, billing overview, staff status
  // - Quick action buttons based on role

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome back. Here is your overview.</p>

      {/* TODO: implement role-specific dashboard content */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
      </div>
    </div>
  );
}
