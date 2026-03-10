/**
 * ClearHealth Web — Stats Card
 *
 * Metric card for dashboard display with icon, label, value, and trend.
 */

import { Card } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatsCard({ icon: Icon, label, value, trend, className }: StatsCardProps) {
  return (
    <Card className={cn('flex items-start gap-4', className)}>
      <div className="rounded-lg bg-brand-50 p-3">
        <Icon className="h-6 w-6 text-brand-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        {trend && (
          <p className={cn('mt-1 text-xs font-medium', trend.isPositive ? 'text-green-600' : 'text-red-600')}>
            {trend.isPositive ? '+' : ''}{trend.value}% from last period
          </p>
        )}
      </div>
    </Card>
  );
}
