/**
 * ClearHealth Web — Medical Records Page
 *
 * Displays patient medical records including visit history,
 * visit notes (SOAP format), and documents.
 * - PATIENT: View own records only
 * - DOCTOR: View records for assigned patients
 * - ADMIN: View all records within tenant
 *
 * @security Medical records contain PHI. Access is logged by the API
 * audit middleware. Never cache PHI on the client side.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { patientApi, appointmentApi } from '@/lib/api-client';
import { NavHeader } from '@/components/nav-header';
import { PatientSummaryCard } from '@/components/data-display/patient-summary-card';
import { AppointmentCard } from '@/components/data-display/appointment-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/useToast';
import type { PatientSummary } from '@clearhealth/shared/types/patient';
import type { Appointment } from '@clearhealth/shared/types/appointment';
import { Loader2, Search, FileText } from 'lucide-react';

export default function RecordsPage() {
  const { user, isLoading, isAuthenticated, isPatient, isAdmin } = useAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [visitHistory, setVisitHistory] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    async function fetchRecords() {
      setDataLoading(true);
      try {
        if (isPatient()) {
          // Patient sees own history directly
          const history = await patientApi.getHistory(user!.id).catch(() => []);
          setVisitHistory(history);
          setSelectedPatientId(user!.id);
        } else {
          // Doctor/Admin see patient list
          const patientList = await patientApi.list().catch(() => []);
          setPatients(patientList);
        }
      } catch {
        toast({ title: 'Failed to load records', variant: 'destructive' });
      } finally {
        setDataLoading(false);
      }
    }
    fetchRecords();
  }, [isAuthenticated, user]);

  const handleSelectPatient = async (patientId: string) => {
    setSelectedPatientId(patientId);
    setHistoryLoading(true);
    try {
      const history = await patientApi.getHistory(patientId);
      setVisitHistory(history);
    } catch {
      toast({ title: 'Failed to load visit history', variant: 'destructive' });
      setVisitHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredPatients = patients.filter((p) =>
    p.medicalRecordNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.insurancePlan && p.insurancePlan.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <NavHeader />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Medical Records</h1>
        <p className="mt-1 text-gray-600">View visit history and medical documents.</p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Patient List (Doctor/Admin only) */}
          {!isPatient() && (
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Patients</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by MRN or insurance..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {dataLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                    </div>
                  ) : filteredPatients.length === 0 ? (
                    <p className="text-sm text-gray-500">No patients found.</p>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {filteredPatients.map((patient) => (
                        <div
                          key={patient.id}
                          className={`cursor-pointer rounded-md transition-colors ${
                            selectedPatientId === patient.id ? 'ring-2 ring-brand-500' : ''
                          }`}
                        >
                          <PatientSummaryCard
                            patient={patient}
                            onClick={() => handleSelectPatient(patient.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Visit History */}
          <div className={isPatient() ? 'lg:col-span-3' : 'lg:col-span-2'}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Visit History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoading || (isPatient() && dataLoading) ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                  </div>
                ) : !selectedPatientId && !isPatient() ? (
                  <p className="text-gray-500 text-center py-8">
                    Select a patient to view their visit history.
                  </p>
                ) : visitHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No visit history found.</p>
                ) : (
                  <div className="space-y-4">
                    {visitHistory
                      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                      .map((visit) => (
                        <div key={visit.id} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={visit.status === 'COMPLETED' ? 'green' : 'blue'}>
                                {visit.status}
                              </Badge>
                              <Badge variant="gray">{visit.type.replace('_', ' ')}</Badge>
                            </div>
                            <span className="text-sm text-gray-500">
                              {new Date(visit.scheduledAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Duration: {visit.duration} min | Doctor ID: {visit.doctorId.slice(0, 8)}...
                          </p>
                          {visit.notes && (
                            <p className="mt-2 text-sm text-gray-500 border-t pt-2">{visit.notes}</p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
