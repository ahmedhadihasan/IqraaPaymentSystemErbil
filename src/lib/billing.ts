/**
 * IqraaPay - Billing Constants and Calculations
 * 
 * Pricing structure:
 * - Single student: 25,000 IQD for 6 months (Jan-July 2026)
 * - Family/Siblings: First student 25,000 + each additional 20,000
 *   - 2 students: 25,000 + 20,000 = 45,000 IQD
 *   - 3 students: 25,000 + 20,000 + 20,000 = 65,000 IQD
 *   - 4 students: 25,000 + 20,000 + 20,000 + 20,000 = 85,000 IQD
 *   - etc. up to 6 students max
 */

// Pricing constants (in IQD)
export const PRICING = {
  SINGLE_STUDENT: 25000,        // First/single student for 6 months
  ADDITIONAL_SIBLING: 20000,    // Each additional sibling for 6 months
  MONTHLY: 5000,                // Per month price
  MAX_FAMILY_MEMBERS: 6,        // Maximum siblings in one family payment
} as const;

// Payment types
export type PaymentType = 'single' | 'family' | 'donation' | 'scholarship';

export const PAYMENT_TYPES = {
  SINGLE: 'single',
  FAMILY: 'family',  // Renamed from 'sibling' to be clearer
  DONATION: 'donation',
  SCHOLARSHIP: 'scholarship',
} as const;

// Class times
export const CLASS_TIMES = [
  'saturday_morning',
  'saturday_evening', 
  'saturday_night',
  'monday_evening',
  'tuesday_night',
  'wednesday_evening',
  'wednesday_night',
  'thursday_night',
] as const;

export type ClassTime = typeof CLASS_TIMES[number];

// Semester dates
export const SEMESTER = {
  START: new Date('2026-01-01'),
  END: new Date('2026-07-01'),
  MONTHS: 6,
} as const;

/**
 * Calculate total payment for a family with multiple students
 * @param studentCount Number of students in the family (1-6)
 * @returns Total amount in IQD
 */
export function calculateFamilyTotal(studentCount: number): number {
  if (studentCount < 1) return 0;
  if (studentCount > PRICING.MAX_FAMILY_MEMBERS) {
    studentCount = PRICING.MAX_FAMILY_MEMBERS;
  }
  
  // First student pays full price, each additional pays discounted
  const firstStudent = PRICING.SINGLE_STUDENT;
  const additionalStudents = (studentCount - 1) * PRICING.ADDITIONAL_SIBLING;
  
  return firstStudent + additionalStudents;
}

/**
 * Get breakdown of payment for each student in a family
 * @param studentCount Number of students
 * @returns Array of amounts for each student
 */
export function getFamilyPaymentBreakdown(studentCount: number): number[] {
  if (studentCount < 1) return [];
  if (studentCount > PRICING.MAX_FAMILY_MEMBERS) {
    studentCount = PRICING.MAX_FAMILY_MEMBERS;
  }
  
  const breakdown: number[] = [PRICING.SINGLE_STUDENT];
  for (let i = 1; i < studentCount; i++) {
    breakdown.push(PRICING.ADDITIONAL_SIBLING);
  }
  
  return breakdown;
}

/**
 * Get suggested amounts for quick selection
 */
export function getSuggestedAmounts(): Array<{ value: number; label: string; studentCount: number }> {
  return [
    { value: 25000, label: 'تاک (1 قوتابی)', studentCount: 1 },
    { value: 45000, label: '2 خوشک و برا', studentCount: 2 },
    { value: 65000, label: '3 خوشک و برا', studentCount: 3 },
    { value: 85000, label: '4 خوشک و برا', studentCount: 4 },
    { value: 105000, label: '5 خوشک و برا', studentCount: 5 },
    { value: 125000, label: '6 خوشک و برا', studentCount: 6 },
  ];
}

/**
 * Round amount to nearest 500 IQD
 */
export function roundToNearest500(amount: number): number {
  return Math.round(amount / 500) * 500;
}
