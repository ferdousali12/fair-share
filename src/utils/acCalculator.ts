/**
 * AC kWh consumption and cost calculator.
 * 
 * AC Power Draw:
 *   - Inverter AC:  0.8 kW/hr
 *   - Non-Inverter: 1.2 kW/hr
 * 
 * Formula:
 *   calculatedAmount = usageHours × kW_type × electricityRatePerkWh
 */

import type { ACType } from '../types';
import { AC_KW_RATES } from '../types';

export interface ACRoomUsage {
  roomId: string;
  hoursUsed: number; // hours the AC was on
}

/**
 * Get the kW draw for a given AC type.
 */
export function getACKWRate(acType: ACType): number {
  return AC_KW_RATES[acType] ?? 0.8;
}

/**
 * Calculate the estimated electricity cost for AC usage.
 */
export function calculateACCost(
  usageHours: number,
  acType: ACType,
  electricityRatePerkWh: number
): number {
  const kwRate = getACKWRate(acType);
  return Math.round(usageHours * kwRate * electricityRatePerkWh * 100) / 100;
}

/**
 * Calculate total AC kWh used by a room over a given number of hours.
 */
export function calculateACKWh(
  tonnage: number,
  hoursUsed: number,
  acCount: number = 1
): number {
  // For simplicity, tonnage multiplier: 1 ton ≈ 1.2 kW cooling capacity base
  // Combined with inverter/non-inverter rates per hour
  // We keep this as an estimation helper
  const basePowerPerTon = 1.2; // kW per ton
  return basePowerPerTon * tonnage * hoursUsed * acCount;
}

/**
 * Auto-detect AC type from a transcript note.
 */
export function detectACType(note: string): ACType {
  const lower = note.toLowerCase();
  if (lower.includes('inverter')) return 'inverter';
  if (lower.includes('non inverter') || lower.includes('non-inverter') || lower.includes('standard') || lower.includes('old')) return 'non_inverter';
  // Default: assume inverter (most common now)
  return 'inverter';
}

/**
 * Extract hours of AC usage from a transcript.
 * Returns null if no hours mentioned.
 */
export function extractUsageHours(transcript: string): number | null {
  const lower = transcript.toLowerCase();
  
  // Patterns: "4 hours", "3 hrs", "2 ghante", "5 hour"
  const patterns = [
    /(\d+)\s*(?:hours?|hrs?|ghante|hr)/i,
    /(?:for|about|around)\s*(\d+)\s*(?:hours?|hrs?|ghante)/i,
    /(\d+)\s*(?:hours?|hrs?)\s*(?:of|ka|ki)\s*(?:ac|air\s*condition)/i,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val > 0 && val <= 24) return val;
    }
  }

  return null;
}

/**
 * Check if a transcript relates to AC usage.
 */
export function isACRelated(text: string): boolean {
  const lower = text.toLowerCase();
  const acKeywords = ['ac', 'air conditioner', 'air condition', 'cooler', 'a.c.', 'aircon'];
  return acKeywords.some(k => lower.includes(k));
}

/**
 * Check if a transcript mentions a category that should trigger auto-calculation.
 */
export function needsACAutoCalc(text: string, category: string): boolean {
  if (category === 'electricity') return true;
  if (isACRelated(text)) return true;
  return false;
}