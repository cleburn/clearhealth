/**
 * ClearHealth Web — Billing Management Page
 *
 * Admin billing dashboard for managing insurance claims,
 * tracking payments, and generating financial reports.
 * Accessible by: ADMIN, SUPER_ADMIN only
 *
 * @security Billing data contains patient PII indirectly through
 * insurance claim details. PII is masked in the API response.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { billingApi } from '@/lib/api-client';
import { NavHeader } from '@/components/nav-header';
import { StatsCard } from '@/components/data-display/stats-card';
import { BillingRecordRow } from '@/components/data-display/billing-record-row';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/useToast';
import type { BillingRecord, BillingReport } from '@clearhealth/shared/types/billing';
import { ClaimStatus } from '@clearhealth/shared/types/billing';
import {
  DollarSign,
  FileCheck,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';

export default function BillingPage() {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [report, setReport] = useState<BillingReport | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
      return;
    }
    if (!isLoading && isAuthenticated && !isAdmin()) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (dateStart) params.dateStart = dateStart;
      if (dateEnd) params.dateEnd = dateEnd;

      const [billingRecords, billingReport] = await Promise.all([
        billingApi.list(params).catch(() => []),
        billingApi.getReports({
          dateStart: dateStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
          dateEnd: dateEnd || new Date().toISOString().split('T')[0],
        }).catch(() => null),
      ]);

      setRecords(billingRecords);
      setReport(billingReport);
    } catch {
      toast({ title: 'Failed to load billing data', variant: 'destructive' });
    } finally {
      setDataLoading(false);
    }
  }, [statusFilter, dateStart, dateEnd]);

  useEffect(() => {
    if (isAuthenticated && isAdmin()) {
      fetchData();
    }
  }, [isAuthenticated, isAdmin, fetchData]);

  const handleSubmitClaim = async (id: string) => {
    try {
      await billingApi.submitClaim(id);
      toast({ title: 'Claim submitted successfully', variant: 'success' });
      fetchData();
    } catch {
      toast({ title: 'Failed to submit claim', variant: 'destructive' });
    }
  };

  const handleFollowUp = async (id: string) => {
    try {
      await billingApi.followUpClaim(id);
      toast({ title: 'Follow-up sent', variant: 'success' });
      fetchData();
    } catch {
      toast({ title: 'Failed to follow up on claim', variant: 'destructive' });
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const pendingCount = records.filter((r) => r.status === ClaimStatus.PENDING).length;
  const submittedCount = records.filter((r) => r.status === ClaimStatus.SUBMITTED).length;
  const approvedCount = records.filter((r) => r.status === ClaimStatus.APPROVED).length;
  const deniedCount = records.filter((r) => r.status === ClaimStatus.DENIED).length;

  return (
    <div>
      <NavHeader />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing Management</h1>
        <p className="mt-1 text-gray-600">Insurance claims, payments, and financial reporting.</p>

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatsCard icon={DollarSign} label="Total Revenue" value={report ? `$${report.totalAmount.toLocaleString()}` : '$0'} />
          <StatsCard icon={AlertCircle} label="Pending" value={pendingCount} />
          <StatsCard icon={FileCheck} label="Submitted" value={submittedCount} />
          <StatsCard icon={CheckCircle} label="Approved" value={approvedCount} />
        </div>

        {/* Filters */}
        <div className="mt-6 rounded-lg border bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {Object.values(ClaimStatus).map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From Date</Label>
              <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>To Date</Label>
              <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>

        {/* Billing Records Table */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing Records</CardTitle>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                </div>
              ) : records.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No billing records found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>CPT Codes</TableHead>
                      <TableHead>ICD Codes</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <BillingRecordRow
                        key={record.id}
                        record={record}
                        onSubmitClaim={handleSubmitClaim}
                        onFollowUp={handleFollowUp}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
