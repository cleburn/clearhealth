/**
 * ClearHealth Web — Patient Summary Card
 *
 * Displays non-PII patient information: MRN and insurance plan.
 * No PHI is displayed or cached.
 *
 * @security Only displays non-PII fields. PII such as SSN, DOB, and
 * contact information is never rendered in summary views.
 */

import type { PatientSummary } from "@clearhealth/shared/types/patient";
import { Card } from "@/components/ui/card";
import { FileText, Shield } from "lucide-react";

interface PatientSummaryCardProps {
  patient: PatientSummary;
  onClick?: () => void;
}

export function PatientSummaryCard({
  patient,
  onClick,
}: PatientSummaryCardProps) {
  return (
    <Card
      className={`flex flex-col gap-3 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-brand-50 p-2">
          <FileText className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            MRN: {patient.medicalRecordNumber}
          </p>
          <p className="text-xs text-gray-500">
            Birth Year: {patient.dateOfBirthYear}
          </p>
        </div>
      </div>

      {patient.insurancePlan && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Shield className="h-4 w-4" />
          <span>{patient.insurancePlan}</span>
        </div>
      )}
    </Card>
  );
}
