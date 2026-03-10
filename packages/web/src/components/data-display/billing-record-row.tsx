/**
 * ClearHealth Web — Billing Record Row
 *
 * Table row component for billing records with status badge and actions.
 *
 * @security Billing data may contain indirect PII through insurance claims.
 * PII fields are masked in API responses.
 */

'use client';

import type { BillingRecord } from '@clearhealth/shared/types/billing';
import { ClaimStatus } from '@clearhealth/shared/types/billing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

const STATUS_VARIANT: Record<ClaimStatus, 'yellow' | 'blue' | 'green' | 'red' | 'emerald'> = {
  [ClaimStatus.PENDING]: 'yellow',
  [ClaimStatus.SUBMITTED]: 'blue',
  [ClaimStatus.APPROVED]: 'green',
  [ClaimStatus.DENIED]: 'red',
  [ClaimStatus.PAID]: 'emerald',
};

interface BillingRecordRowProps {
  record: BillingRecord;
  onSubmitClaim?: (id: string) => void;
  onFollowUp?: (id: string) => void;
}

export function BillingRecordRow({ record, onSubmitClaim, onFollowUp }: BillingRecordRowProps) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{record.id.slice(0, 8)}...</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[record.status]}>{record.status}</Badge>
      </TableCell>
      <TableCell className="font-medium">${record.amount.toFixed(2)}</TableCell>
      <TableCell className="text-xs text-gray-500">
        {record.cptCodes.join(', ') || '-'}
      </TableCell>
      <TableCell className="text-xs text-gray-500">
        {record.icdCodes.join(', ') || '-'}
      </TableCell>
      <TableCell className="text-xs text-gray-500">
        {format(new Date(record.createdAt), 'MMM d, yyyy')}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          {record.status === ClaimStatus.PENDING && onSubmitClaim && (
            <Button size="sm" variant="outline" onClick={() => onSubmitClaim(record.id)}>
              Submit
            </Button>
          )}
          {(record.status === ClaimStatus.SUBMITTED || record.status === ClaimStatus.DENIED) && onFollowUp && (
            <Button size="sm" variant="outline" onClick={() => onFollowUp(record.id)}>
              Follow Up
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
