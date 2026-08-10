/**
 * IESCO tariff-connected electricity bill calculator.
 *
 * Flow:
 *   Actual meter units
 *        ↓ GET /api/tariff-rates (Supabase Edge Function `fetch-tariffs`)
 *        ↓ Protected / Un-Protected slabs
 *        ↓ Find applicable slab
 *        ↓ Calculate energy charge
 *        ↓ Add fixed charge (phase based)
 *        ↓ Final electricity bill
 *
 * The Edge Function returns `{ protected: TariffItem[], unprotected: TariffItem[],
 * source: 'live' | 'fallback', fetchedAt }`. When the live scrape fails the
 * function itself returns February 2026 fallback data, so the UI always has
 * usable slabs and can still calculate a bill.
 */

import { supabase } from '../lib/supabase';
import type { ConsumerStatus, ElectricityBillResult } from '../types';

export type TariffConsumerStatus = 'protected' | 'unprotected';

export interface TariffItem {
  minUnits: number | null;
  maxUnits: number | null;
  ratePerKWh: number;
  fixedCharges: number | null;
  rawUnitText: string;
}

export interface TariffData {
  protected: TariffItem[];
  unprotected: TariffItem[];
  source: 'live' | 'fallback';
  fetchedAt: string;
  warning?: string;
}

/* ── Fixed charges (configurable per connection phase) ── */

export const FIXED_CHARGE_BY_PHASE: Record<'single' | 'three-phase', number> = {
  single: 75,
  'three-phase': 150,
};

/* ── Fetch the current IESCO tariff from the existing API ── */

export async function fetchTariffRates(): Promise<TariffData> {
  const { data, error } = await supabase.functions.invoke<TariffData>('fetch-tariffs', {
    method: 'GET',
  });

  if (error) throw new Error(error.message || 'Failed to fetch tariff rates');

  // Defensive: the function always returns usable data (live or fallback),
  // but if a consumer-status list is missing, throw so we never silently
  // calculate with an unrelated rate.
  if (!data || (data.protected.length === 0 && data.unprotected.length === 0)) {
    throw new Error('No usable tariff data available');
  }

  return data;
}

/* ── Slab selection ── */

function pickSlab(
  slabs: TariffItem[],
  units: number
): { slab: TariffItem; index: number } | null {
  // Find ALL slabs containing the unit count, then pick the most specific
  // (narrowest range) — when ranges overlap this avoids returning a wide
  // bracket that also matches.
  let best: { slab: TariffItem; index: number; span: number } | null = null;

  for (let i = 0; i < slabs.length; i++) {
    const slab = slabs[i];
    const min = slab.minUnits ?? 0;
    const max = slab.maxUnits ?? Infinity;
    if (units >= min && units <= max) {
      const span = max === Infinity ? Infinity : max - min;
      if (!best || span < best.span || (span === best.span && i < best.index)) {
        best = { slab, index: i, span };
      }
    }
  }
  return best ? { slab: best.slab, index: best.index } : null;
}

/* ── Un-Protected: whole month at the slab rate ── */

export function calculateUnprotectedEnergyCharge(units: number, slabs: TariffItem[]) {
  const found = pickSlab(slabs, units);
  if (!found) {
    // Units below the first slab — fall back to the lowest slab rate.
    const first = slabs[0];
    return { energyCharge: units * first.ratePerKWh, ratePerKWh: first.ratePerKWh, slabUsed: first.rawUnitText };
  }
  return {
    energyCharge: units * found.slab.ratePerKWh,
    ratePerKWh: found.slab.ratePerKWh,
    slabUsed: found.slab.rawUnitText,
  };
}

/* ── Protected: previous-slab benefit ── */

export function calculateProtectedEnergyCharge(units: number, slabs: TariffItem[]) {
  const found = pickSlab(slabs, units);
  if (!found) {
    const first = slabs[0];
    return { energyCharge: units * first.ratePerKWh, ratePerKWh: first.ratePerKWh, slabUsed: first.rawUnitText };
  }

  const { slab, index } = found;

  // For the lowest slab there is no "previous slab" — charge everything at its rate.
  if (index === 0) {
    return {
      energyCharge: units * slab.ratePerKWh,
      ratePerKWh: slab.ratePerKWh,
      slabUsed: slab.rawUnitText,
    };
  }

  const prev = slabs[index - 1];
  const prevCeiling = prev.maxUnits ?? prev.minUnits ?? 0;

  const unitsAtPreviousRate = Math.min(units, prevCeiling);
  const unitsAtCurrentRate = units - unitsAtPreviousRate;

  const energyCharge =
    unitsAtPreviousRate * prev.ratePerKWh + unitsAtCurrentRate * slab.ratePerKWh;

  return {
    energyCharge,
    ratePerKWh: slab.ratePerKWh,
    slabUsed: slab.rawUnitText,
  };
}

/* ── Fixed charge by phase ── */

export function calculateFixedCharge(phase: 'single' | 'three-phase'): number {
  return FIXED_CHARGE_BY_PHASE[phase] ?? FIXED_CHARGE_BY_PHASE.single;
}

/* ── Main entry: calculate the monthly bill ── */

export async function calculateElectricityBill(
  totalUnits: number,
  consumerStatus: ConsumerStatus,
  phase: 'single' | 'three-phase'
): Promise<ElectricityBillResult> {
  if (!totalUnits || totalUnits <= 0) {
    throw new Error('Meter units must be greater than zero');
  }

  // 1. Obtain the current IESCO tariff through the existing API.
  const tariff = await fetchTariffRates();

  // 2. Pick the slab list for this consumer status.
  const slabs =
    consumerStatus === 'unprotected' ? tariff.unprotected : tariff.protected;

  if (slabs.length === 0) {
    throw new Error(`No ${consumerStatus} tariff slabs available`);
  }

  // 3. Energy charge.
  const energy =
    consumerStatus === 'unprotected'
      ? calculateUnprotectedEnergyCharge(totalUnits, slabs)
      : calculateProtectedEnergyCharge(totalUnits, slabs);

  // 4. Fixed charge (phase based).
  const fixedCharge = calculateFixedCharge(phase);

  // 5. Final bill.
  const totalBill = Math.round((energy.energyCharge + fixedCharge) * 100) / 100;

  return {
    totalUnits,
    ratePerKWh: energy.ratePerKWh,
    energyCharge: Math.round(energy.energyCharge * 100) / 100,
    fixedCharge,
    totalBill,
    slabUsed: energy.slabUsed,
    tariffSource: tariff.source,
    tariffFetchedAt: tariff.fetchedAt,
    consumerStatus,
  };
}

/**
 * Fallback for when the tariff API is unreachable: still calculate using the
 * bundled February 2026 fallback slabs so a live-tariff problem never breaks
 * the bill calculation. Throws only if no data is usable at all.
 */
export function calculateElectricityBillWithFallback(
  totalUnits: number,
  consumerStatus: ConsumerStatus,
  phase: 'single' | 'three-phase',
  fallbackTariff: TariffData
): ElectricityBillResult {
  const slabs =
    consumerStatus === 'unprotected'
      ? fallbackTariff.unprotected
      : fallbackTariff.protected;

  if (slabs.length === 0) {
    throw new Error('No usable tariff data at all — cannot calculate the bill');
  }

  const energy =
    consumerStatus === 'unprotected'
      ? calculateUnprotectedEnergyCharge(totalUnits, slabs)
      : calculateProtectedEnergyCharge(totalUnits, slabs);

  const fixedCharge = calculateFixedCharge(phase);
  const totalBill = Math.round((energy.energyCharge + fixedCharge) * 100) / 100;

  return {
    totalUnits,
    ratePerKWh: energy.ratePerKWh,
    energyCharge: Math.round(energy.energyCharge * 100) / 100,
    fixedCharge,
    totalBill,
    slabUsed: energy.slabUsed,
    tariffSource: fallbackTariff.source,
    tariffFetchedAt: fallbackTariff.fetchedAt,
    consumerStatus,
  };
}

/* ── Label helpers for the UI ── */

export function formatSlabLabel(slab: TariffItem): string {
  if (slab.maxUnits === null) return `Above ${slab.minUnits} units`;
  return `${slab.minUnits}–${slab.maxUnits} units`;
}
