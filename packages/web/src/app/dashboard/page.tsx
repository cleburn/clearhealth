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

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { appointmentApi, billingApi, patientApi } from '@/lib/api-client';
import { NavHeader } from '@/components/nav-header';
import { StatsCard } from '@/components/data-display/stats-card';
import { AppointmentCard } from '@/components/data-display/appointment-card';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Appointment } from '@clearhealth/shared/types/appointment';
import type { BillingReport } from '@clearhealth/shared/types/billing';
import type { PatientSummary } from '@clearhealth/shared/types/patient';
import {
  Calendar,
  Users,
  DollarSign,
  Clock,
  Plus,
  ClipboardList,
  FileText,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated, isPatient, isDoctor, isAdmin } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [billingReport, setBillingReport] = useState<BillingReport | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    async function fetchDashboardData() {
      setDataLoading(true);
      try {
        // Fetch appointments for all roles
        const appts = await appointmentApi.list().catch(() => []);
        setAppointments(appts);

        // Admin-specific data
        if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
          const patientList = await patientApi.list().catch(() => []);
          setPatients(patientList);

          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
          const report = await billingApi.getReports({ dateStart: monthStart, dateEnd: monthEnd }).catch(() => null);
          setBillingReport(report);
        }
      } catch {
        // Errors handled gracefully — show empty state
      } finally {
        setDataLoading(false);
      }
    }
    fetchDashboardData();
  }, [isAuthenticated, user]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  const todayAppts = appointments.filter((a) => {
    const date = new Date(a.scheduledAt);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  });

  const upcomingAppts = appointments
    .filter((a) => new Date(a.scheduledAt) >= new Date() && a.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 5);

  return (
    <div>
      <NavHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-600">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ''}. Here is your overview.
          </p>
        </div>

        {/* PATIENT Dashboard */}
        {isPatient() && (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-8">
              <StatsCard
                icon={Calendar}
                label="Upcoming Appointments"
                value={upcomingAppts.length}
              />
              <StatsCard
                icon={Clock}
                label="Next Appointment"
                value={upcomingAppts[0] ? new Date(upcomingAppts[0].scheduledAt).toLocaleDateString() : 'None'}
              />
              <StatsCard
                icon={FileText}
                label="Total Visits"
                value={appointments.filter((a) => a.status === 'COMPLETED').length}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Appointments</CardTitle>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <p className="text-gray-500">Loading...</p>
                  ) : upcomingAppts.length === 0 ? (
                    <p className="text-gray-500">No upcoming appointments.</p>
                  ) : (
                    <div className="space-y-3">
                      {upcomingAppts.map((appt) => (
                        <AppointmentCard key={appt.id} appointment={appt} showActions={false} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link href="/appointments">
                    <Button className="w-full justify-start" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Book an Appointment
                    </Button>
                  </Link>
                  <Link href="/records">
                    <Button className="w-full justify-start mt-2" variant="outline">
                      <FileText className="mr-2 h-4 w-4" />
                      View Medical Records
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* DOCTOR Dashboard */}
        {isDoctor() && (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-8">
              <StatsCard
                icon={Calendar}
                label="Today's Appointments"
                value={todayAppts.length}
              />
              <StatsCard
                icon={ClipboardList}
                label="Pending Notes"
                value={appointments.filter((a) => a.status === 'COMPLETED').length}
              />
              <StatsCard
                icon={Users}
                label="Total Patients"
                value={new Set(appointments.map((a) => a.patientId)).size}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Today&apos;s Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <p className="text-gray-500">Loading...</p>
                  ) : todayAppts.length === 0 ? (
                    <p className="text-gray-500">No appointments today.</p>
                  ) : (
                    <div className="space-y-3">
                      {todayAppts.map((appt) => (
                        <AppointmentCard key={appt.id} appointment={appt} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link href="/appointments">
                    <Button className="w-full justify-start" variant="outline">
                      <Calendar className="mr-2 h-4 w-4" />
                      View Full Schedule
                    </Button>
                  </Link>
                  <Link href="/records">
                    <Button className="w-full justify-start mt-2" variant="outline">
                      <FileText className="mr-2 h-4 w-4" />
                      Patient Records
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* ADMIN Dashboard */}
        {isAdmin() && (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4 mb-8">
              <StatsCard
                icon={Users}
                label="Total Patients"
                value={patients.length}
              />
              <StatsCard
                icon={Calendar}
                label="Appointments Today"
                value={todayAppts.length}
              />
              <StatsCard
                icon={DollarSign}
                label="Monthly Revenue"
                value={billingReport ? `$${billingReport.totalAmount.toLocaleString()}` : '$0'}
              />
              <StatsCard
                icon={TrendingUp}
                label="Total Claims"
                value={billingReport?.totalClaims || 0}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Today&apos;s Appointments</CardTitle>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <p className="text-gray-500">Loading...</p>
                  ) : todayAppts.length === 0 ? (
                    <p className="text-gray-500">No appointments today.</p>
                  ) : (
                    <div className="space-y-3">
                      {todayAppts.slice(0, 3).map((appt) => (
                        <AppointmentCard key={appt.id} appointment={appt} showActions={false} />
                      ))}
                      {todayAppts.length > 3 && (
                        <Link href="/appointments">
                          <Button variant="link" className="w-full">
                            View all {todayAppts.length} appointments
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link href="/admin/billing">
                    <Button className="w-full justify-start" variant="outline">
                      <DollarSign className="mr-2 h-4 w-4" />
                      Billing Management
                    </Button>
                  </Link>
                  <Link href="/admin/staff">
                    <Button className="w-full justify-start mt-2" variant="outline">
                      <Users className="mr-2 h-4 w-4" />
                      Staff Management
                    </Button>
                  </Link>
                  <Link href="/appointments">
                    <Button className="w-full justify-start mt-2" variant="outline">
                      <Calendar className="mr-2 h-4 w-4" />
                      All Appointments
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Billing Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {billingReport ? (
                    <div className="space-y-2 text-sm">
                      {Object.entries(billingReport.byStatus).map(([status, data]) => (
                        <div key={status} className="flex justify-between">
                          <span className="text-gray-600">{status}</span>
                          <span className="font-medium">{data.count} (${data.amount.toLocaleString()})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No billing data available.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
