/**
 * ClearHealth Web — Admin Dashboard
 *
 * Administrative overview for clinic managers. Provides access to
 * billing, staff management, and clinic-wide metrics.
 * Accessible by: ADMIN, SUPER_ADMIN only
 *
 * @security Admin routes are protected by role-based route guards.
 * ADMIN can only access data within their tenant.
 */

'use client';

import type { UserRole } from '@clearhealth/shared/constants/roles';

export default function AdminPage() {
  // TODO: implement
  // - Verify user has ADMIN or SUPER_ADMIN role
  // - Redirect unauthorized users to /dashboard
  // - Display admin navigation: Billing, Staff, Reports, Settings
  // - Clinic-wide metrics: appointment volume, revenue, no-show rate

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
      <p className="mt-2 text-gray-600">Clinic management and reporting.</p>

      {/* TODO: implement admin dashboard */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <a href="/admin/billing" className="rounded-lg border bg-white p-6 shadow-sm hover:shadow-md">
          <h2 className="text-lg font-semibold text-gray-900">Billing</h2>
          <p className="mt-2 text-gray-500">Insurance claims, payments, and financial reports.</p>
        </a>
        <a href="/admin/staff" className="rounded-lg border bg-white p-6 shadow-sm hover:shadow-md">
          <h2 className="text-lg font-semibold text-gray-900">Staff Management</h2>
          <p className="mt-2 text-gray-500">Manage doctors, staff accounts, and permissions.</p>
        </a>
      </div>
    </div>
  );
}
