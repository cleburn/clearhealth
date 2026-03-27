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

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { appointmentApi } from "@/lib/api-client";
import { NavHeader } from "@/components/nav-header";
import { AppointmentCard } from "@/components/data-display/appointment-card";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/useToast";
import type { Appointment } from "@clearhealth/shared/types/appointment";
import { AppointmentStatus } from "@clearhealth/shared/types/appointment";
import type { AppointmentFormData } from "@/lib/validators";
import { Plus, Loader2 } from "lucide-react";

export default function AppointmentsPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<
    Appointment[]
  >([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showBookDialog, setShowBookDialog] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  const fetchAppointments = useCallback(async () => {
    setDataLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateStart) params.dateStart = dateStart;
      if (dateEnd) params.dateEnd = dateEnd;
      if (statusFilter !== "ALL") params.status = statusFilter;
      const data = await appointmentApi.list(params);
      setAppointments(data);
    } catch {
      toast({ title: "Failed to load appointments", variant: "destructive" });
    } finally {
      setDataLoading(false);
    }
  }, [dateStart, dateEnd, statusFilter]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAppointments();
    }
  }, [isAuthenticated, fetchAppointments]);

  // Apply client-side type filter
  useEffect(() => {
    let filtered = [...appointments];
    if (typeFilter !== "ALL") {
      filtered = filtered.filter((a) => a.type === typeFilter);
    }
    filtered.sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    );
    setFilteredAppointments(filtered);
  }, [appointments, typeFilter]);

  const handleBook = async (data: AppointmentFormData) => {
    await appointmentApi.create({
      patientId: user?.id || "",
      doctorId: data.doctorId,
      scheduledAt: new Date(data.scheduledAt).toISOString(),
      duration: data.duration,
      type: data.type as Appointment["type"],
      notes: data.notes,
    });
    toast({ title: "Appointment booked successfully", variant: "success" });
    setShowBookDialog(false);
    fetchAppointments();
  };

  const handleCancel = async (id: string) => {
    try {
      await appointmentApi.update(id, { status: AppointmentStatus.CANCELLED });
      toast({ title: "Appointment cancelled", variant: "default" });
      fetchAppointments();
    } catch {
      toast({ title: "Failed to cancel appointment", variant: "destructive" });
    }
  };

  const handleCheckin = async (id: string) => {
    try {
      await appointmentApi.checkin(id);
      toast({ title: "Checked in successfully", variant: "success" });
      fetchAppointments();
    } catch {
      toast({ title: "Failed to check in", variant: "destructive" });
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await appointmentApi.complete(id);
      toast({ title: "Appointment completed", variant: "success" });
      fetchAppointments();
    } catch {
      toast({
        title: "Failed to complete appointment",
        variant: "destructive",
      });
    }
  };

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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <Button onClick={() => setShowBookDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Book Appointment
          </Button>
        </div>

        {/* Filters */}
        <div className="rounded-lg border bg-white p-4 shadow-sm mb-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {Object.values(AppointmentStatus).map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="INITIAL">Initial</SelectItem>
                  <SelectItem value="FOLLOW_UP">Follow-Up</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                  <SelectItem value="TELEHEALTH">Telehealth</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>From Date</Label>
              <Input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>To Date</Label>
              <Input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Appointment List */}
        {dataLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No appointments found.</p>
            <Button className="mt-4" onClick={() => setShowBookDialog(true)}>
              Book your first appointment
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAppointments.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                onCancel={handleCancel}
                onCheckin={handleCheckin}
                onComplete={handleComplete}
              />
            ))}
          </div>
        )}

        {/* Book Appointment Dialog */}
        <Dialog open={showBookDialog} onOpenChange={setShowBookDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Book New Appointment</DialogTitle>
              <DialogDescription>
                Fill in the details below to schedule a new appointment.
              </DialogDescription>
            </DialogHeader>
            <AppointmentForm
              onSubmit={handleBook}
              onCancel={() => setShowBookDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
