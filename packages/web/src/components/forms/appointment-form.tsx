/**
 * ClearHealth Web — Appointment Booking Form
 *
 * Form for booking a new appointment with doctor selection,
 * date/time picker, and appointment type.
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { appointmentSchema, type AppointmentFormData } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface AppointmentFormProps {
  onSubmit: (data: AppointmentFormData) => Promise<void>;
  onCancel: () => void;
}

export function AppointmentForm({ onSubmit, onCancel }: AppointmentFormProps) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      duration: 30,
      type: 'FOLLOW_UP',
    },
  });

  const handleFormSubmit = async (data: AppointmentFormData) => {
    setError(null);
    try {
      await onSubmit(data);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr?.error || 'Failed to book appointment. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div>
        <Label htmlFor="doctorId">Doctor ID</Label>
        <Input
          id="doctorId"
          placeholder="Select a doctor"
          {...register('doctorId')}
          className="mt-1"
        />
        {errors.doctorId && (
          <p className="mt-1 text-xs text-red-600">{errors.doctorId.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="scheduledAt">Date & Time</Label>
        <Input
          id="scheduledAt"
          type="datetime-local"
          {...register('scheduledAt')}
          className="mt-1"
        />
        {errors.scheduledAt && (
          <p className="mt-1 text-xs text-red-600">{errors.scheduledAt.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Select
          onValueChange={(val) => setValue('duration', parseInt(val, 10))}
          defaultValue="30"
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select duration" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="45">45 minutes</SelectItem>
            <SelectItem value="60">60 minutes</SelectItem>
            <SelectItem value="90">90 minutes</SelectItem>
            <SelectItem value="120">120 minutes</SelectItem>
          </SelectContent>
        </Select>
        {errors.duration && (
          <p className="mt-1 text-xs text-red-600">{errors.duration.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="type">Appointment Type</Label>
        <Select
          onValueChange={(val) => setValue('type', val as AppointmentFormData['type'])}
          defaultValue="FOLLOW_UP"
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INITIAL">Initial Visit</SelectItem>
            <SelectItem value="FOLLOW_UP">Follow-Up</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
            <SelectItem value="TELEHEALTH">Telehealth</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="mt-1 text-xs text-red-600">{errors.type.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          {...register('notes')}
          className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
          placeholder="Any additional notes for the appointment..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Booking...
            </>
          ) : (
            'Book Appointment'
          )}
        </Button>
      </div>
    </form>
  );
}
