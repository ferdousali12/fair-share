import type { ExpenseCategory, ParsedExpense, SplitType, ExpenseScope } from '../types';

const CATEGORY_KEYWORDS: Record<ExpenseCategory, string[]> = {
  groceries: ['grocery', 'groceries', 'food', 'vegetables', 'fruits', 'milk', 'bread', 'eggs', 'dinner', 'lunch', 'breakfast', 'snacks', 'provisions', 'rations', 'supermarket', 'store', 'market'],
  utilities: ['utility', 'utilities', 'bills', 'bill'],
  rent: ['rent', 'rental', 'flat rent'],
  electricity: ['electricity', 'electric', 'power', 'current', 'light bill', 'electric bill', 'kwh', 'unit', 'electricity bill', 'bijli', 'biji'],
  water: ['water', 'water bill', 'water supply', 'paani'],
  gas: ['gas', 'gas bill', 'cylinder', 'lpg', 'cooking gas', 'gas cylinder'],
  internet: ['internet', 'wifi', 'broadband', 'data', 'network', 'wi-fi'],
  other: [],
};

const AMOUNT_PATTERNS = [
  /\b(?:rs\.?\s*|₹\s*|rupees?\s*)?(\d{2,6}(?:[.,]\d{1,2})?)\s*(?:rs\.?|₹|rupees?)?\b/i,
  /\b(\d{2,6}(?:[.,]\d{1,2})?)\s*(?:rupees?|rs\.?|₹)\b/i,
  /(?:paid|spent|cost|worth|bought|for|gave|pay|sent)\s*(?:rs\.?\s*|₹\s*|rupees?\s*)?(\d{2,6}(?:[.,]\d{1,2})?)/i,
];

const DURATION_PATTERNS = [
  /(\d+)\s*(minutes?|mins?|hrs?|hours?|kWh|units?)/i,
];

/**
 * Extract hours of AC usage from transcript.
 */
function extractUsageHours(text: string): number | null {
  const lower = text.toLowerCase();
  const patterns = [
    /(\d+)\s*(?:hours?|hrs?|ghante|hr)/i,
    /(?:for|about|around)\s*(\d+)\s*(?:hours?|hrs?|ghante)/i,
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

function findCategory(text: string): ExpenseCategory {
  const lower = text.toLowerCase();

  // Check for AC-related text → electricity
  const acKeywords = ['ac', 'air conditioner', 'air condition', 'cooler', 'a.c.', 'aircon'];
  if (acKeywords.some(k => lower.includes(k))) return 'electricity';

  if (CATEGORY_KEYWORDS.electricity.some(k => lower.includes(k))) return 'electricity';
  if (CATEGORY_KEYWORDS.water.some(k => lower.includes(k))) return 'water';
  if (CATEGORY_KEYWORDS.gas.some(k => lower.includes(k))) return 'gas';
  if (CATEGORY_KEYWORDS.internet.some(k => lower.includes(k))) return 'internet';
  if (CATEGORY_KEYWORDS.rent.some(k => lower.includes(k))) return 'rent';
  if (CATEGORY_KEYWORDS.groceries.some(k => lower.includes(k))) return 'groceries';
  if (CATEGORY_KEYWORDS.utilities.some(k => lower.includes(k))) return 'utilities';

  return 'other';
}

function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const num = parseFloat(match[1].replace(',', ''));
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

function extractDuration(text: string): { amount: number; unit: 'kWh' | 'minutes' | 'liters' | 'units' } | undefined {
  const lower = text.toLowerCase();
  const match = lower.match(DURATION_PATTERNS[0]);
  if (match) {
    const val = parseInt(match[1], 10);
    const unitWord = match[2].toLowerCase();
    if (unitWord.startsWith('min')) return { amount: val, unit: 'minutes' };
    if (unitWord.startsWith('hr') || unitWord.startsWith('hour')) return { amount: val, unit: 'minutes' };
    if (unitWord.startsWith('kwh')) return { amount: val, unit: 'kWh' };
    if (unitWord.startsWith('unit')) return { amount: val, unit: 'units' };
  }
  return undefined;
}

function detectSplitType(category: ExpenseCategory, text: string): SplitType {
  const lower = text.toLowerCase();
  if (category === 'rent') return 'equal';
  const usageKeywords = ['heater', 'ac', 'cooler', 'fan', 'appliance', 'usage', 'used', 'consumed', 'kwh', 'units', 'minutes', 'hours'];
  if (usageKeywords.some(k => lower.includes(k))) return 'usage';
  if ((category === 'electricity' || category === 'water' || category === 'gas') && DURATION_PATTERNS.some(p => p.test(text))) {
    return 'usage';
  }
  return 'equal';
}

function detectScope(category: ExpenseCategory, text: string): ExpenseScope {
  const lower = text.toLowerCase();
  // Personal indicators
  const personalKeywords = ['myself', 'for me', 'my own', 'personal', 'individual', 'only me', 'just me'];
  if (personalKeywords.some(k => lower.includes(k))) return 'individual';

  // AC usage without amount is individual by default
  const acKeywords = ['ac', 'air conditioner', 'air condition', 'cooler', 'a.c.'];
  if (acKeywords.some(k => lower.includes(k)) && !extractAmount(text)) {
    return 'individual'; // personal AC usage tracks individual consumption
  }

  // Collect groceries from shared list
  if (category === 'groceries') return 'collective';
  if (category === 'rent') return 'collective';
  if (category === 'electricity' && extractAmount(text)) return 'collective'; // bill payment

  return 'individual';
}

export function parseExpenseInput(text: string): ParsedExpense {
  const category = findCategory(text);
  const amount = extractAmount(text);
  const duration = extractDuration(text);
  const splitType = detectSplitType(category, text);
  const scope = detectScope(category, text);
  const usageHours = extractUsageHours(text);

  return {
    amount,
    category,
    note: text.trim(),
    splitType,
    scope,
    usageAmount: duration?.amount,
    usageUnit: duration?.unit,
    usageHours: usageHours ?? undefined,
  };
}