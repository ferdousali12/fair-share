/**
 * Month-end reconciliation with AC cost integration.
 *
 * Reconciliation Equation:
 *   Total Tracked AC Costs = Sum of all personal AC expenses in the current month
 *   Baseline Shared Bill = Actual Total Bill Input - Total Tracked AC Costs
 *   Shared Baseline Per Person = Baseline Shared Bill / Count(Roommates Sharing Electricity)
 *   Final Person Charge = Person's Tracked AC Cost + Shared Baseline Per Person
 */

import type { Expense, Roommate, FlatSettings, SplitResult } from '../types';
import { calculateSplit } from './splitter';

export function settleMonth(
  expenses: Expense[],
  roommates: Roommate[],
  settings: FlatSettings,
  month: number,
  year: number
): {
  result: SplitResult;
  settledLabel: string;
} {
  const result = calculateSplit(expenses, roommates, settings, month, year);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const settledLabel = `${monthNames[month]} ${year}`;
  return { result, settledLabel };
}

export function isMonthSettled(settledMonths: string[], month: number, year: number): boolean {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${monthNames[month]} ${year}`;
  return settledMonths.includes(label);
}

/**
 * Calculate the total tracked AC costs for a month (individual electricity/AC expenses).
 */
export function calculateTotalACKCosts(expenses: Expense[], month: number, year: number): number {
  return expenses
    .filter((e) => {
      const d = new Date(e.timestamp);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .filter((e) => e.category === 'electricity' && e.scope === 'individual')
    .reduce((sum, e) => sum + (e.calculatedAmount ?? e.amount), 0);
}

/**
 * Calculate the final person charge using the reconciliation equation.
 */
export function calculateFinalPersonCharge(
  personACKCost: number,
  baselineSharedBill: number,
  roommateCount: number
): number {
  const sharedPerPerson = roommateCount > 0 ? baselineSharedBill / roommateCount : 0;
  return personACKCost + sharedPerPerson;
}

/**
 * Compute baseline shared bill after removing tracked AC costs.
 */
export function calculateBaselineSharedBill(
  totalElectricityBill: number,
  totalTrackedACCosts: number
): number {
  return Math.max(0, totalElectricityBill - totalTrackedACCosts);
}