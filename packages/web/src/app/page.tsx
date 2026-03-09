/**
 * ClearHealth Web — Login Page
 *
 * Landing page with login form. Redirects authenticated users to /dashboard.
 * Includes "Forgot password" link for password recovery flow.
 *
 * @security
 * - Form submission uses HTTPS only
 * - Password field is never stored in component state beyond submission
 * - Failed login attempts show generic error (no user enumeration)
 */

'use client';

import type { LoginRequest } from '@clearhealth/shared/types/auth';

export default function LoginPage() {
  // TODO: implement
  // - Check if user is already authenticated -> redirect to /dashboard
  // - Login form with email + password fields
  // - Form validation using Zod loginSchema
  // - Submit handler: call auth API, store tokens, redirect
  // - "Forgot password?" link -> /forgot-password
  // - Display error messages for failed login attempts
  // - Loading state during authentication

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-900">ClearHealth</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>

        {/* TODO: implement login form */}
        <form className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-brand-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            Sign in
          </button>

          <div className="text-center">
            <a href="/forgot-password" className="text-sm text-brand-600 hover:text-brand-500">
              Forgot your password?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
