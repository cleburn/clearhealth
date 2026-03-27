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

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/forms/login-form";
import type { LoginFormData } from "@/lib/validators";

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleLogin = async (data: LoginFormData) => {
    await login(data);
    router.push("/dashboard");
  };

  // Show nothing while checking auth status
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600 mx-auto" />
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-900">ClearHealth</h1>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>

        <LoginForm onSubmit={handleLogin} />
      </div>
    </div>
  );
}
