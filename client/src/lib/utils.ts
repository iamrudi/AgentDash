import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if ('errors' in error && Array.isArray(error.errors)) {
      const errors = error.errors as Array<{ message: string }>;
      return errors.map(e => e.message).join(', ');
    }
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}
