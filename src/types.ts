/* ── Core Data Types ── */

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' | 'MYR' | 'PKR';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  locale: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', locale: 'en-IN' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB' },
  AUD: { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
  CAD: { code: 'CAD', symbol: 'C$', locale: 'en-CA' },
  SGD: { code: 'SGD', symbol: 'S$', locale: 'en-SG' },
  MYR: { code: 'MYR', symbol: 'RM', locale: 'ms-MY' },
  PKR: { code: 'PKR', symbol: 'Rs.', locale: 'en-PK' },
};

export type ExpenseCategory =
  | 'groceries'
  | 'utilities'
  | 'rent'
  | 'electricity'
  | 'water'
  | 'gas'
  | 'internet'
  | 'other';

export type SplitType = 'equal' | 'usage';
export type ExpenseScope = 'individual' | 'collective';
export type ApprovalStatus = 'approved' | 'pending_approval' | 'rejected';
export type ACType = 'inverter' | 'non_inverter';

/* ── Room ── */

export interface Room {
  id: string;
  name: string;
  acType: ACType;
  tonnage: number; // e.g. 1.5
  acCount: number; // number of AC units
  rentWeightage: number; // proportion of total rent
  connectionPhase: 'single' | 'three-phase'; // single-phase → Rs75/month fixed, three-phase → Rs150/month
}

/* ── Roommate ── */

export interface Roommate {
  id: string;
  name: string;
  color: string;
  roomId: string;
  sharedGroceriesOptIn: boolean;
  wifiShared: boolean; // WiFi sharing toggle
}

/* ── Expense ── */

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  paidBy: string; // roommate id
  note: string;
  timestamp: number;
  splitType: SplitType;
  scope: ExpenseScope;
  approvalStatus: ApprovalStatus;
  usageAmount?: number;
  usageUnit?: 'kWh' | 'minutes' | 'liters' | 'units';
  usageHours?: number; // hours AC was used
  calculatedAmount?: number; // auto-calculated by backend formulas
  roomId?: string; // which room this pertains to
  requiresReapproval?: boolean;
}

/* ── Approval Request ── */

export interface ApprovalVote {
  roommateId: string;
  vote: 'approve' | 'reject';
  timestamp: number;
}

export interface ApprovalRequest {
  id: string;
  expenseId: string;
  expense: Expense;
  votes: ApprovalVote[];
  status: ApprovalStatus;
  createdAt: number;
  requestedBy: string;
}

/* ── Activity Log ── */

export type ActivityType =
  | 'expense_added'
  | 'expense_edited'
  | 'expense_deleted'
  | 'expense_approved'
  | 'expense_rejected'
  | 'ac_calculated'
  | 'expense_settled'
  | 'roommate_added'
  | 'roommate_removed'
  | 'settings_updated'
  | 'month_settled';

export interface ActivityLogEntry {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: number;
  expenseId?: string;
  roommateId?: string;
  userId?: string;
  userName?: string;
}

/* ── Featherless Parser Config ── */

export interface SharedGroceryItem {
  id: string;
  name: string;
  category: ExpenseCategory;
}

/* ── App Settings (persisted) ── */

export interface SplitRules {
  rent: 'equal' | 'usage';
  utilities: 'usage' | 'equal';
  groceries: 'equal';
}

export type GasType = 'pipeline' | 'cylinder';
export type ConsumerStatus = 'protected' | 'unprotected';

export interface FlatSettings {
  groupName: string;
  currency: CurrencyCode;
  rooms: Room[];
  roommates: Roommate[];
  sharedGroceries: SharedGroceryItem[];
  electricityRate: number;
  waterRate: number;
  gasRate: number;
  gasType: GasType;
  gasCylinderRate: number; // cost per refill when gasType = 'cylinder'
  splitRules: SplitRules;
  consumerStatus: ConsumerStatus; // IESCO consumer status
}

/* ── Electricity Bill Calculation Result ── */

export interface ElectricityBillResult {
  totalUnits: number;
  ratePerKWh: number;
  energyCharge: number;
  fixedCharge: number;
  totalBill: number;
  slabUsed: string;
  tariffSource: 'live' | 'fallback';
  tariffFetchedAt: string;
  consumerStatus: ConsumerStatus;
}

/* ── App State ── */

export interface AppState {
  isSetupComplete: boolean;
  settings: FlatSettings;
  expenses: Expense[];
  approvalRequests: ApprovalRequest[];
  activityLog: ActivityLogEntry[];
  activeRoommateId: string | null;
  settledMonths: string[];
}

/* ── Actions ── */

export type AppAction =
  | { type: 'COMPLETE_SETUP'; payload: FlatSettings }
  | { type: 'SET_ACTIVE_ROOMMATE'; payload: string }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'REMOVE_EXPENSE'; payload: string }
  | { type: 'UPDATE_EXPENSE'; payload: Expense }
  | { type: 'ADD_APPROVAL_REQUEST'; payload: ApprovalRequest }
  | { type: 'CAST_VOTE'; payload: { requestId: string; vote: ApprovalVote } }
  | { type: 'UPDATE_APPROVAL_STATUS'; payload: { requestId: string; status: ApprovalStatus } }
  | { type: 'ADD_ACTIVITY_LOG'; payload: ActivityLogEntry }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<FlatSettings> }
  | { type: 'ADD_ROOM'; payload: Room }
  | { type: 'REMOVE_ROOM'; payload: string }
  | { type: 'UPDATE_ROOM'; payload: Room }
  | { type: 'ADD_ROOMMATE'; payload: Roommate }
  | { type: 'REMOVE_ROOMMATE'; payload: string }
  | { type: 'UPDATE_ROOMMATE'; payload: Roommate }
  | { type: 'ADD_SHARED_GROCERY'; payload: SharedGroceryItem }
  | { type: 'REMOVE_SHARED_GROCERY'; payload: string }
  | { type: 'SETTLE_MONTH'; payload: string }
  | { type: 'LOAD_FROM_DB'; payload: { expenses: Expense[]; activityLog: ActivityLogEntry[]; settings: FlatSettings | null } }
  | { type: 'RESET_ALL' };

/* ── Derived / View Types ── */

export type ViewType = 'dashboard' | 'split' | 'settings';

export interface ParsedExpense {
  amount: number | null;
  category: ExpenseCategory;
  note: string;
  splitType: SplitType;
  scope: ExpenseScope;
  usageAmount?: number;
  usageUnit?: 'kWh' | 'minutes' | 'liters' | 'units';
  usageHours?: number; // hours of AC usage
}

export interface SplitResult {
  totalExpenses: number;
  perPerson: {
    roommateId: string;
    name: string;
    color: string;
    totalPaid: number;
    totalOwes: number;
    netBalance: number;
  }[];
  transactions: {
    from: string;
    fromName: string;
    to: string;
    toName: string;
    amount: number;
  }[];
  monthLabel: string;
}

/* ── AC kW constants ── */

export const AC_KW_RATES: Record<ACType, number> = {
  inverter: 0.8,
  non_inverter: 1.2,
};