import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format amount in IQD currency
 */
export function formatIQD(amount: number): string {
  return new Intl.NumberFormat('en-IQ', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' IQD';
}

/**
 * Calculate days between two dates (inclusive)
 */
export function daysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Format date to display string
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export function formatDateInput(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Get current course code based on date
 */
export function getCurrentCourseCode(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  
  // Course A: Jan-Jun (months 0-5)
  // Course B: Jul-Dec (months 6-11)
  const semester = month < 6 ? 'A' : 'B';
  return `${year}${semester}`;
}

/**
 * Get course dates for a given course code
 */
export function getCourseDates(courseCode: string): { start: Date; end: Date } {
  const year = parseInt(courseCode.slice(0, 4));
  const semester = courseCode.slice(4);
  
  if (semester === 'A') {
    return {
      start: new Date(year, 0, 1), // Jan 1
      end: new Date(year, 5, 30),  // Jun 30
    };
  } else {
    return {
      start: new Date(year, 6, 1),  // Jul 1
      end: new Date(year, 11, 31),  // Dec 31
    };
  }
}

/**
 * Calculate overdue days from due date
 */
export function calculateOverdueDays(dueDate: Date | null): number {
  if (!dueDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Get status badge color based on status
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    withdrawn: 'bg-red-100 text-red-800',
    graduated: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get payment plan display name
 */
export function getPaymentPlanDisplay(plan: string): string {
  const plans: Record<string, string> = {
    six_month: '6-Month',
    monthly: 'Monthly',
    forgiven: 'Scholarship',
    custom: 'Custom',
  };
  return plans[plan] || plan;
}
