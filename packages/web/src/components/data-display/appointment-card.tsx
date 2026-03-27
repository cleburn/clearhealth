/**
 * ClearHealth Web — Appointment Card
 *
 * Displays an appointment summary with status badge and action buttons.
 */

"use client";

import type { Appointment } from "@clearhealth/shared/types/appointment";
import { AppointmentStatus } from "@clearhealth/shared/types/appointment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";

const STATUS_VARIANT: Record<
  AppointmentStatus,
  "blue" | "green" | "yellow" | "red" | "orange" | "gray"
> = {
  [AppointmentStatus.SCHEDULED]: "blue",
  [AppointmentStatus.CONFIRMED]: "green",
  [AppointmentStatus.IN_PROGRESS]: "yellow",
  [AppointmentStatus.COMPLETED]: "green",
  [AppointmentStatus.CANCELLED]: "red",
  [AppointmentStatus.NO_SHOW]: "orange",
};

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel?: (id: string) => void;
  onCheckin?: (id: string) => void;
  onComplete?: (id: string) => void;
  showActions?: boolean;
}

export function AppointmentCard({
  appointment,
  onCancel,
  onCheckin,
  onComplete,
  showActions = true,
}: AppointmentCardProps) {
  const scheduledDate = new Date(appointment.scheduledAt);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[appointment.status]}>
            {appointment.status.replace("_", " ")}
          </Badge>
          <Badge variant="gray">{appointment.type.replace("_", " ")}</Badge>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>{format(scheduledDate, "EEEE, MMMM d, yyyy")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>
            {format(scheduledDate, "h:mm a")} ({appointment.duration} min)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span>Doctor ID: {appointment.doctorId.slice(0, 8)}...</span>
        </div>
      </div>

      {appointment.notes && (
        <p className="text-sm text-gray-500">{appointment.notes}</p>
      )}

      {showActions && (
        <div className="flex gap-2 pt-2 border-t">
          {appointment.status === AppointmentStatus.SCHEDULED && onCheckin && (
            <Button size="sm" onClick={() => onCheckin(appointment.id)}>
              Check In
            </Button>
          )}
          {appointment.status === AppointmentStatus.IN_PROGRESS &&
            onComplete && (
              <Button size="sm" onClick={() => onComplete(appointment.id)}>
                Complete
              </Button>
            )}
          {(appointment.status === AppointmentStatus.SCHEDULED ||
            appointment.status === AppointmentStatus.CONFIRMED) &&
            onCancel && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onCancel(appointment.id)}
              >
                Cancel
              </Button>
            )}
        </div>
      )}
    </Card>
  );
}
