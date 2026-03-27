'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

export function NavHeader() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-semibold text-gray-900">
            ClearHealth
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/appointments" className="text-gray-600 hover:text-gray-900">
              Appointments
            </Link>
            <Link href="/records" className="text-gray-600 hover:text-gray-900">
              Records
            </Link>
            {isAdmin() && (
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-gray-600">
              {user.firstName} {user.lastName}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => logout()}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
