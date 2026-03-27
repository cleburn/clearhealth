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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { appointmentApi, billingApi, patientApi } from "@/lib/api-client";
import { NavHeader } from "@/components/nav-header";
import { StatsCard } from "@/components/data-display/stats-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Appointment } from "@clearhealth/shared/types/appointment";
import type { BillingReport } from "@clearhealth/shared/types/billing";
import {
  Calendar,
  Users,
  DollarSign,
  AlertTriangle,
  CreditCard,
  UserCog,
  BarChart3,
  Loader2,
} from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [billingReport, setBillingReport] = useState<BillingReport | null>(
    null,
  );
  const [patientCount, setPatientCount] = useState(0);
  const [, setDataLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
      return;
    }
    if (!isLoading && isAuthenticated && !isAdmin()) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin()) return;

    async function fetchAdminData() {
      setDataLoading(true);
      try {
        const [appts, patients] = await Promise.all([
          appointmentApi.list().catch(() => []),
          patientApi.list().catch(() => []),
        ]);
        setAppointments(appts);
        setPatientCount(patients.length);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split("T")[0];
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString()
          .split("T")[0];
        const report = await billingApi
          .getReports({ dateStart: monthStart, dateEnd: monthEnd })
          .catch(() => null);
        setBillingReport(report);
      } catch {
        // Handle gracefully
      } finally {
        setDataLoading(false);
      }
    }
    fetchAdminData();
  }, [isAuthenticated, isAdmin]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const _todayAppts = appointments.filter((a) => {
    const date = new Date(a.scheduledAt);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  });

  const noShowCount = appointments.filter((a) => a.status === "NO_SHOW").length;
  const totalAppts = appointments.length;
  const noShowRate =
    totalAppts > 0 ? ((noShowCount / totalAppts) * 100).toFixed(1) : "0.0";

  return (
    <div>
      <NavHeader />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="mt-1 text-gray-600">Clinic management and reporting.</p>

        {/* Summary Metrics */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <StatsCard
            icon={Calendar}
            label="Appointment Volume"
            value={appointments.length}
          />
          <StatsCard
            icon={DollarSign}
            label="Monthly Revenue"
            value={
              billingReport
                ? `$${billingReport.totalAmount.toLocaleString()}`
                : "$0"
            }
          />
          <StatsCard
            icon={AlertTriangle}
            label="No-Show Rate"
            value={`${noShowRate}%`}
          />
          <StatsCard icon={Users} label="Total Patients" value={patientCount} />
        </div>

        {/* Navigation Cards */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Link href="/admin/billing">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="flex items-start gap-4 pt-6">
                <div className="rounded-lg bg-emerald-50 p-3">
                  <CreditCard className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Billing Management
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Insurance claims, payments, and financial reports.
                  </p>
                  {billingReport && (
                    <p className="mt-2 text-sm font-medium text-emerald-600">
                      {billingReport.totalClaims} active claims
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/staff">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="flex items-start gap-4 pt-6">
                <div className="rounded-lg bg-brand-50 p-3">
                  <UserCog className="h-8 w-8 text-brand-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Staff Management
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage doctors, staff accounts, and permissions.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Billing Breakdown */}
        {billingReport && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Revenue by Provider
                </CardTitle>
              </CardHeader>
              <CardContent>
                {billingReport.byProvider.length === 0 ? (
                  <p className="text-gray-500">No provider data available.</p>
                ) : (
                  <div className="space-y-3">
                    {billingReport.byProvider.map((provider) => (
                      <div
                        key={provider.doctorId}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {provider.doctorName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {provider.claimCount} claims
                          </p>
                        </div>
                        <p className="text-lg font-semibold text-gray-900">
                          ${provider.totalAmount.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
