import { format } from 'date-fns';

/**
 * App-wide date formatting helpers.
 * Standard: DD-MM-YYYY (with HH:mm when time is meaningful).
 */

type DateInput = Date | string | number | null | undefined;

function toDate(d: DateInput): Date | null {
  if (d == null || d === '') return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return null;
  return date;
}

export function formatDate(d: DateInput, fallback = ''): string {
  const date = toDate(d);
  return date ? format(date, 'dd-MM-yyyy') : fallback;
}

export function formatDateTime(d: DateInput, fallback = ''): string {
  const date = toDate(d);
  return date ? format(date, 'dd-MM-yyyy HH:mm') : fallback;
}
