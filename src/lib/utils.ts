import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strip every non-digit and clamp to `max` characters. */
export function digitsOnly(value: string, max?: number): string {
  const stripped = String(value || '').replace(/\D/g, '');
  return typeof max === 'number' ? stripped.slice(0, max) : stripped;
}
