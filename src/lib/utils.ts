import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string (yyyy-MM-dd) or Date object for display.
 * Using parseISO instead of new Date() for date-only strings prevents
 * the UTC-to-local timezone shift that shows the day before.
 */
export function formatDate(dateStr: string | Date | null | undefined, pattern = 'MMM d, yyyy'): string {
  if (!dateStr) return '-';
  if (dateStr instanceof Date) return format(dateStr, pattern);
  return format(parseISO(dateStr), pattern);
}
