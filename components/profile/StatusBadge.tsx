'use client';

import { getStatusColor } from './utils';

interface StatusBadgeProps {
  readonly status: string;
  readonly className?: string;
}

/**
 * Reusable status badge component
 */
export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)} ${className}`}>
      {status}
    </span>
  );
}
