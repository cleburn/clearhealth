/**
 * ClearHealth Web — Utility Functions
 *
 * Class name merging utility for shadcn/ui components.
 * Combines clsx conditional class logic with tailwind-merge
 * to resolve Tailwind CSS class conflicts.
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class names with Tailwind conflict resolution */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
