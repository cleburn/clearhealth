/**
 * ClearHealth Web — Visit Note Display
 *
 * Renders a SOAP-format visit note with expandable sections.
 *
 * @security Visit notes contain PHI. They are fetched on demand from the API
 * and never cached in client-side storage.
 */

"use client";

import { useState } from "react";
import type { VisitNote } from "@clearhealth/shared/types/appointment";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, FileCheck } from "lucide-react";
import { format } from "date-fns";

interface VisitNoteDisplayProps {
  note: VisitNote;
}

export function VisitNoteDisplay({ note }: VisitNoteDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <FileCheck className="h-5 w-5 text-brand-600" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              Visit Note — {format(new Date(note.createdAt), "MMM d, yyyy")}
            </p>
            <p className="text-xs text-gray-500">
              Doctor ID: {note.doctorId.slice(0, 8)}...
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {note.isSigned && <Badge variant="green">Signed</Badge>}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4 border-t pt-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Subjective
            </h4>
            <p className="mt-1 text-sm text-gray-700">{note.subjective}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Objective
            </h4>
            <p className="mt-1 text-sm text-gray-700">{note.objective}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Assessment
            </h4>
            <p className="mt-1 text-sm text-gray-700">{note.assessment}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Plan
            </h4>
            <p className="mt-1 text-sm text-gray-700">{note.plan}</p>
          </div>
          {note.isSigned && note.signedAt && (
            <p className="text-xs text-gray-400">
              Signed on {format(new Date(note.signedAt), "MMM d, yyyy h:mm a")}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
