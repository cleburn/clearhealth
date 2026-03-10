/**
 * ClearHealth Web — Patient Intake Form
 *
 * New patient registration form with validation.
 *
 * @security
 * - SSN is validated but immediately sent to API on submission
 * - SSN is cleared from form state after successful submission
 * - No PII is cached in client-side storage
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientIntakeSchema, type PatientIntakeFormData } from '@/lib/validators';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface PatientIntakeFormProps {
  onSubmit: (data: PatientIntakeFormData) => Promise<void>;
  onCancel: () => void;
}

export function PatientIntakeForm({ onSubmit, onCancel }: PatientIntakeFormProps) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientIntakeFormData>({
    resolver: zodResolver(patientIntakeSchema),
  });

  const handleFormSubmit = async (data: PatientIntakeFormData) => {
    setError(null);
    try {
      await onSubmit(data);
      // Clear form (especially SSN) after successful submission
      reset();
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr?.error || 'Failed to register patient. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name</Label>
          <Input id="firstName" {...register('firstName')} className="mt-1" />
          {errors.firstName && (
            <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="lastName">Last Name</Label>
          <Input id="lastName" {...register('lastName')} className="mt-1" />
          {errors.lastName && (
            <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register('email')} className="mt-1" />
        {errors.email && (
          <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" type="tel" placeholder="+1 (555) 123-4567" {...register('phone')} className="mt-1" />
        {errors.phone && (
          <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="dateOfBirth">Date of Birth</Label>
        <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} className="mt-1" />
        {errors.dateOfBirth && (
          <p className="mt-1 text-xs text-red-600">{errors.dateOfBirth.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="ssn">Social Security Number</Label>
        <Input
          id="ssn"
          placeholder="XXX-XX-XXXX"
          {...register('ssn')}
          className="mt-1"
          autoComplete="off"
        />
        {errors.ssn && (
          <p className="mt-1 text-xs text-red-600">{errors.ssn.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          SSN is encrypted before storage and never displayed after submission.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="insuranceId">Insurance ID (optional)</Label>
          <Input id="insuranceId" {...register('insuranceId')} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="insurancePlan">Insurance Plan (optional)</Label>
          <Input id="insurancePlan" {...register('insurancePlan')} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
          <Input id="emergencyContactName" {...register('emergencyContactName')} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
          <Input id="emergencyContactPhone" type="tel" {...register('emergencyContactPhone')} className="mt-1" />
          {errors.emergencyContactPhone && (
            <p className="mt-1 text-xs text-red-600">{errors.emergencyContactPhone.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registering...
            </>
          ) : (
            'Register Patient'
          )}
        </Button>
      </div>
    </form>
  );
}
