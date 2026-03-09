/**
 * ClearHealth Web — Staff Management Page
 *
 * Manage clinic staff accounts, roles, and permissions.
 * Accessible by: ADMIN, SUPER_ADMIN only
 *
 * @security Staff role changes are logged in the audit trail.
 * Only ADMIN and SUPER_ADMIN can modify user roles.
 * SUPER_ADMIN role assignment requires another SUPER_ADMIN.
 */

'use client';

import type { User } from '@clearhealth/shared/types/auth';
import type { UserRole } from '@clearhealth/shared/constants/roles';

export default function StaffPage() {
  // TODO: implement
  // - List all staff (doctors, admins) in the tenant
  // - Add new staff member form
  // - Edit staff profile and role assignment
  // - Deactivate/reactivate staff accounts
  // - View staff schedules (doctors)
  // - Role change requires confirmation dialog

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="mt-2 text-gray-600">Manage clinic staff accounts and roles.</p>
        </div>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
          Add Staff Member
        </button>
      </div>

      {/* TODO: implement staff list and management */}
      <div className="mt-6">
        <p className="text-gray-500">Loading staff...</p>
      </div>
    </div>
  );
}
