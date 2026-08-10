import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import type {
  AppState,
  AppAction,
  Expense,
  FlatSettings,
  Roommate,
  Room,
  ApprovalRequest,
  ApprovalVote,
  ActivityLogEntry,
  SharedGroceryItem,
} from '../types';
import { generateId } from '../utils/format';
import { supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';

const STORAGE_KEY = 'fairshare_local_v3';

const initialState: AppState = {
  isSetupComplete: false,
  settings: {
    groupName: '',
    currency: 'PKR',
    rooms: [],
    roommates: [],
    sharedGroceries: [],
    electricityRate: 50,
    waterRate: 10,
    gasRate: 50,
    gasType: 'pipeline',
    gasCylinderRate: 0,
    splitRules: {
      rent: 'equal',
      utilities: 'usage',
      groceries: 'equal',
    },
    consumerStatus: 'protected',
  },
  expenses: [],
  approvalRequests: [],
  activityLog: [],
  activeRoommateId: null,
  settledMonths: [],
};

function loadLocalState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      // Migration: ensure new settings fields exist for older saved state
      if (parsed.settings) {
        if (parsed.settings.consumerStatus === undefined) {
          parsed.settings.consumerStatus = 'protected';
        }
        parsed.settings.rooms = (parsed.settings.rooms || []).map((r) => ({
          ...r,
          connectionPhase: r.connectionPhase ?? 'single',
        }));
      }
      return parsed;
    }
  } catch { /* corrupted */ }
  return initialState;
}

function saveLocalState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* unavailable */ }
}

/* ── Activity Log Helper ── */

function addActivity(
  log: ActivityLogEntry[],
  entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>
): ActivityLogEntry[] {
  return [
    { ...entry, id: generateId(), timestamp: Date.now() },
    ...log,
  ];
}

/* ── Supabase helpers ── */

async function syncExpenseToDB(expense: Expense) {
  try {
    await supabase.from('expenses').upsert({
      id: expense.id,
      amount: expense.calculatedAmount ?? expense.amount,
      category: expense.category,
      note: expense.note,
      paid_by: expense.paidBy,
      scope: expense.scope,
      status: expense.approvalStatus,
      room_id: expense.roomId ?? null,
      split_type: expense.splitType,
      usage_amount: expense.usageAmount ?? null,
      usage_unit: expense.usageUnit ?? null,
      usage_hours: expense.usageHours ?? null,
      calculated_amount: expense.calculatedAmount ?? null,
      user_id: null,
      created_by: expense.paidBy,
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('Failed to sync expense to DB:', e);
  }
}

async function deleteExpenseFromDB(id: string) {
  try {
    await supabase.from('expenses').delete().eq('id', id);
  } catch (e) {
    console.warn('Failed to delete expense from DB:', e);
  }
}

async function syncSettingsToDB(settings: FlatSettings) {
  try {
    const { data: existing } = await supabase.from('group_settings').select('id').limit(1).maybeSingle();
    const payload = {
      group_name: settings.groupName,
      currency: settings.currency,
      electricity_rate: settings.electricityRate,
      water_rate: settings.waterRate,
      gas_rate: settings.gasRate,
      gas_type: settings.gasType,
      gas_cylinder_rate: settings.gasCylinderRate,
      consumer_status: settings.consumerStatus ?? 'protected',
      rooms: JSON.parse(JSON.stringify(settings.rooms)),
      roommates: JSON.parse(JSON.stringify(settings.roommates)),
      shared_groceries: JSON.parse(JSON.stringify(settings.sharedGroceries)),
      split_rules: JSON.parse(JSON.stringify(settings.splitRules)),
    };
    if (existing) {
      await supabase.from('group_settings').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('group_settings').insert(payload);
    }
  } catch (e) {
    console.warn('Failed to sync settings to DB:', e);
  }
}

async function loadFromDB(): Promise<{ expenses: Expense[]; activityLog: ActivityLogEntry[]; settings: FlatSettings | null }> {
  try {
    const [expensesRes, logsRes, settingsRes] = await Promise.all([
      supabase.from('expenses').select('*').order('created_at', { ascending: false }),
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('group_settings').select('*').limit(1).maybeSingle(),
    ]);

    const expenses: Expense[] = (expensesRes.data ?? []).map((r: Tables<'expenses'>) => ({
      id: r.id,
      amount: r.amount,
      category: r.category as Expense['category'],
      paidBy: r.paid_by,
      note: r.note,
      timestamp: new Date(r.created_at).getTime(),
      splitType: r.split_type as 'equal' | 'usage',
      scope: r.scope as 'individual' | 'collective',
      approvalStatus: r.status as 'approved' | 'pending_approval' | 'rejected',
      usageAmount: r.usage_amount ?? undefined,
      usageUnit: r.usage_unit as Expense['usageUnit'] | undefined,
      usageHours: r.usage_hours ?? undefined,
      calculatedAmount: r.calculated_amount ?? undefined,
      roomId: r.room_id ?? undefined,
    }));

    const activityLog: ActivityLogEntry[] = (logsRes.data ?? []).map((r: Tables<'activity_logs'>) => ({
      id: r.id,
      type: r.action_type as ActivityLogEntry['type'],
      message: r.description,
      timestamp: new Date(r.created_at).getTime(),
      userId: r.user_id || undefined,
      userName: r.user_name || undefined,
      expenseId: (r.metadata as any)?.expenseId,
    }));

    let settings: FlatSettings | null = null;
    if (settingsRes.data) {
      const s = settingsRes.data;
      settings = {
        groupName: s.group_name,
        currency: s.currency as FlatSettings['currency'],
        rooms: (s.rooms as unknown as Room[] || []).map((r) => ({
          ...r,
          connectionPhase: r.connectionPhase ?? 'single',
        })),
        roommates: s.roommates as unknown as Roommate[],
        sharedGroceries: s.shared_groceries as unknown as SharedGroceryItem[],
        electricityRate: s.electricity_rate,
        waterRate: s.water_rate,
        gasRate: s.gas_rate,
        gasType: (s.gas_type || 'pipeline') as FlatSettings['gasType'],
        gasCylinderRate: s.gas_cylinder_rate || 0,
        splitRules: s.split_rules as unknown as FlatSettings['splitRules'],
        consumerStatus: (s as any).consumer_status ?? 'protected',
      };
    }

    return { expenses, activityLog, settings };
  } catch (e) {
    console.warn('Failed to load from DB:', e);
    return { expenses: [], activityLog: [], settings: null };
  }
}

/* ── Reducer ── */

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'COMPLETE_SETUP':
      return {
        ...state,
        isSetupComplete: true,
        settings: action.payload,
        activeRoommateId: action.payload.roommates[0]?.id || null,
      };

    case 'SET_ACTIVE_ROOMMATE':
      return { ...state, activeRoommateId: action.payload };

    case 'ADD_EXPENSE': {
      const expense = action.payload;

      // ── Strict Individual vs Collective Logic ──
      // Individual items auto-approve, NEVER go to approval queue
      // Only collective items trigger pending_approval
      const isAutoApproved = expense.scope === 'individual';

      const finalExpense: Expense = {
        ...expense,
        approvalStatus: isAutoApproved ? 'approved' : 'pending_approval',
      };

      let expenses = [finalExpense, ...state.expenses];
      let approvalRequests = state.approvalRequests;
      let activityLog = state.activityLog;

      if (!isAutoApproved) {
        // Collective → go to approval queue
        const request: ApprovalRequest = {
          id: generateId(),
          expenseId: finalExpense.id,
          expense: finalExpense,
          votes: [],
          status: 'pending_approval',
          createdAt: Date.now(),
          requestedBy: finalExpense.paidBy,
        };
        approvalRequests = [request, ...state.approvalRequests];

        activityLog = addActivity(activityLog, {
          type: 'expense_added',
          message: `${finalExpense.note} (${finalExpense.category}) — Rs.${finalExpense.amount} added, pending approval`,
          expenseId: finalExpense.id,
          userId: finalExpense.paidBy,
        });
      } else {
        // Individual → auto-approved, no approval request
        activityLog = addActivity(activityLog, {
          type: 'expense_added',
          message: `${finalExpense.note} (${finalExpense.category}) — Rs.${finalExpense.amount} added (individual, auto-approved)`,
          expenseId: finalExpense.id,
          userId: finalExpense.paidBy,
        });

        // If this was an AC calculation, log that too
        if (finalExpense.calculatedAmount && finalExpense.category === 'electricity') {
          activityLog = addActivity(activityLog, {
            type: 'ac_calculated',
            message: `AC usage: ${finalExpense.usageHours}h × Rs.${finalExpense.amount / (finalExpense.usageHours || 1)}/kWh = Rs.${finalExpense.calculatedAmount}`,
            expenseId: finalExpense.id,
            userId: finalExpense.paidBy,
          });
        }
      }

      return { ...state, expenses, approvalRequests, activityLog };
    }

    case 'REMOVE_EXPENSE': {
      const expenses = state.expenses.filter((e) => e.id !== action.payload);
      const approvalRequests = state.approvalRequests.filter(
        (r) => r.expenseId !== action.payload
      );
      const activityLog = addActivity(state.activityLog, {
        type: 'expense_deleted',
        message: `Expense was deleted`,
        expenseId: action.payload,
      });
      return { ...state, expenses, approvalRequests, activityLog };
    }

    case 'UPDATE_EXPENSE': {
      const updated = action.payload;
      const expenses = state.expenses.map((e) =>
        e.id === updated.id ? updated : e
      );

      let approvalRequests = state.approvalRequests;
      const existingRequest = state.approvalRequests.find(
        (r) => r.expenseId === updated.id
      );

      if (existingRequest && existingRequest.status === 'approved') {
        approvalRequests = state.approvalRequests.filter(
          (r) => r.expenseId !== updated.id
        );
        const newRequest: ApprovalRequest = {
          id: generateId(),
          expenseId: updated.id,
          expense: { ...updated, requiresReapproval: true },
          votes: [],
          status: 'pending_approval',
          createdAt: Date.now(),
          requestedBy: updated.paidBy,
        };
        approvalRequests = [newRequest, ...approvalRequests];
      }

      const activityLog = addActivity(state.activityLog, {
        type: 'expense_edited',
        message: `Expense "${updated.note}" was edited`,
        expenseId: updated.id,
      });

      return { ...state, expenses, approvalRequests, activityLog };
    }

    case 'ADD_APPROVAL_REQUEST':
      return {
        ...state,
        approvalRequests: [action.payload, ...state.approvalRequests],
      };

    case 'CAST_VOTE': {
      const { requestId, vote } = action.payload;
      const approvalRequests = state.approvalRequests.map((r) => {
        if (r.id !== requestId) return r;
        const existingVoteIndex = r.votes.findIndex(
          (v) => v.roommateId === vote.roommateId
        );
        let newVotes: ApprovalVote[];
        if (existingVoteIndex >= 0) {
          newVotes = [...r.votes];
          newVotes[existingVoteIndex] = vote;
        } else {
          newVotes = [...r.votes, vote];
        }
        return { ...r, votes: newVotes };
      });
      return { ...state, approvalRequests };
    }

    case 'UPDATE_APPROVAL_STATUS': {
      const { requestId, status } = action.payload;
      const approvalRequests = state.approvalRequests.map((r) =>
        r.id === requestId ? { ...r, status } : r
      );

      const request = state.approvalRequests.find((r) => r.id === requestId);
      let expenses = state.expenses;
      let activityLog = state.activityLog;
      if (request) {
        expenses = state.expenses.map((e) =>
          e.id === request.expenseId
            ? { ...e, approvalStatus: status }
            : e
        );

        activityLog = addActivity(activityLog, {
          type: status === 'approved' ? 'expense_approved' : 'expense_rejected',
          message: `Expense "${request.expense.note}" was ${status}`,
          expenseId: request.expenseId,
        });
      }

      return { ...state, approvalRequests, expenses, activityLog };
    }

    case 'ADD_ACTIVITY_LOG':
      return {
        ...state,
        activityLog: [action.payload, ...state.activityLog],
      };

    case 'UPDATE_SETTINGS': {
      const newSettings = { ...state.settings, ...action.payload };
      const activityLog = addActivity(state.activityLog, {
        type: 'settings_updated',
        message: 'Settings were updated',
      });
      return { ...state, settings: newSettings, activityLog };
    }

    case 'ADD_ROOM':
      return {
        ...state,
        settings: {
          ...state.settings,
          rooms: [...state.settings.rooms, action.payload],
        },
      };

    case 'REMOVE_ROOM':
      return {
        ...state,
        settings: {
          ...state.settings,
          rooms: state.settings.rooms.filter((r) => r.id !== action.payload),
        },
      };

    case 'UPDATE_ROOM':
      return {
        ...state,
        settings: {
          ...state.settings,
          rooms: state.settings.rooms.map((r) =>
            r.id === action.payload.id ? action.payload : r
          ),
        },
      };

    case 'ADD_ROOMMATE':
      return {
        ...state,
        settings: {
          ...state.settings,
          roommates: [...state.settings.roommates, action.payload],
        },
      };

    case 'REMOVE_ROOMMATE':
      return {
        ...state,
        settings: {
          ...state.settings,
          roommates: state.settings.roommates.filter(
            (r) => r.id !== action.payload
          ),
        },
        activeRoommateId:
          state.activeRoommateId === action.payload
            ? state.settings.roommates[0]?.id || null
            : state.activeRoommateId,
      };

    case 'UPDATE_ROOMMATE':
      return {
        ...state,
        settings: {
          ...state.settings,
          roommates: state.settings.roommates.map((r) =>
            r.id === action.payload.id ? action.payload : r
          ),
        },
      };

    case 'ADD_SHARED_GROCERY':
      return {
        ...state,
        settings: {
          ...state.settings,
          sharedGroceries: [
            ...state.settings.sharedGroceries,
            action.payload,
          ],
        },
      };

    case 'REMOVE_SHARED_GROCERY':
      return {
        ...state,
        settings: {
          ...state.settings,
          sharedGroceries: state.settings.sharedGroceries.filter(
            (g) => g.id !== action.payload
          ),
        },
      };

    case 'SETTLE_MONTH':
      return {
        ...state,
        settledMonths: [...state.settledMonths, action.payload],
        activityLog: addActivity(state.activityLog, {
          type: 'month_settled',
          message: `${action.payload} was settled! 🎉`,
        }),
      };

    case 'LOAD_FROM_DB':
      return {
        ...state,
        expenses: action.payload.expenses,
        activityLog: action.payload.activityLog,
        settings: action.payload.settings || state.settings,
        isSetupComplete: action.payload.settings ? true : state.isSetupComplete,
        activeRoommateId: action.payload.settings?.roommates[0]?.id || state.activeRoommateId,
      };

    case 'RESET_ALL':
      return initialState;

    default:
      return state;
  }
}

/* ── Context ── */

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  addExpense: (expense: Omit<Expense, 'id' | 'timestamp'>) => void;
  removeExpense: (id: string) => void;
  updateExpense: (expense: Expense) => void;
  completeSetup: (settings: FlatSettings) => void;
  addRoommate: (name: string, roomId: string) => void;
  removeRoommate: (id: string) => void;
  updateRoommate: (roommate: Roommate) => void;
  addRoom: (name: string, acType: Room['acType'], tonnage: number, acCount: number, rentWeightage: number) => void;
  removeRoom: (id: string) => void;
  updateRoom: (room: Room) => void;
  updateSettings: (settings: Partial<FlatSettings>) => void;
  resetAll: () => void;
  setActiveRoommate: (id: string) => void;
  getRoommateById: (id: string) => Roommate | undefined;
  getRoomById: (id: string) => Room | undefined;
  castVote: (requestId: string, vote: ApprovalVote) => void;
  finalizeApproval: (requestId: string, status: 'approved' | 'rejected') => void;
  settleMonth: (label: string) => void;
  addSharedGrocery: (item: SharedGroceryItem) => void;
  removeSharedGrocery: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, null, loadLocalState);
  const isInitialized = useRef(false);
  const dbSyncRef = useRef(false);

  // On mount: load from Supabase DB if available, fallback to local state
  useEffect(() => {
    if (dbSyncRef.current) return;
    dbSyncRef.current = true;

    loadFromDB().then((dbData) => {
      if (dbData.expenses.length > 0 || dbData.activityLog.length > 0) {
        // DB has data — use it
        dispatch({ type: 'LOAD_FROM_DB', payload: dbData });
      }
      // If local state has expenses but DB doesn't, we keep local
      // This handles the first-time migration from localStorage to DB
    });
  }, []);

  // Persist to localStorage on every state change
  useEffect(() => {
    if (isInitialized.current) {
      saveLocalState(state);
    }
    isInitialized.current = true;
  }, [state]);

  const addExpense = useCallback(
    (expense: Omit<Expense, 'id' | 'timestamp'>) => {
      const newExpense: Expense = {
        ...expense,
        id: generateId(),
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_EXPENSE', payload: newExpense });
      // Sync to DB async
      syncExpenseToDB(newExpense);
    },
    []
  );

  const removeExpense = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_EXPENSE', payload: id });
    deleteExpenseFromDB(id);
  }, []);

  const updateExpense = useCallback((expense: Expense) => {
    dispatch({ type: 'UPDATE_EXPENSE', payload: expense });
    syncExpenseToDB(expense);
  }, []);

  const completeSetup = useCallback((settings: FlatSettings) => {
    dispatch({ type: 'COMPLETE_SETUP', payload: settings });
    syncSettingsToDB(settings);
  }, []);

  const addRoommate = useCallback((name: string, roomId: string) => {
    const newRoommate: Roommate = {
      id: generateId(),
      name,
      color: '',
      roomId,
      sharedGroceriesOptIn: false,
      wifiShared: false,
    };
    dispatch({ type: 'ADD_ROOMMATE', payload: newRoommate });
  }, []);

  const removeRoommate = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ROOMMATE', payload: id });
  }, []);

  const updateRoommate = useCallback((roommate: Roommate) => {
    dispatch({ type: 'UPDATE_ROOMMATE', payload: roommate });
  }, []);

  const addRoom = useCallback(
    (name: string, acType: Room['acType'], tonnage: number, acCount: number, rentWeightage: number) => {
      const newRoom: Room = {
        id: generateId(),
        name,
        acType,
        tonnage,
        acCount,
        rentWeightage,
        connectionPhase: 'single',
      };
      dispatch({ type: 'ADD_ROOM', payload: newRoom });
    },
    []
  );

  const removeRoom = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ROOM', payload: id });
  }, []);

  const updateRoom = useCallback((room: Room) => {
    dispatch({ type: 'UPDATE_ROOM', payload: room });
  }, []);

  const updateSettings = useCallback((s: Partial<FlatSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: s });
  }, []);

  const resetAll = useCallback(async () => {
    dispatch({ type: 'RESET_ALL' });
    // Also clear Supabase
    try {
      await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('group_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch {
      // ignore
    }
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const setActiveRoommate = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE_ROOMMATE', payload: id });
  }, []);

  const getRoommateById = useCallback(
    (id: string) => state.settings.roommates.find((r) => r.id === id),
    [state.settings.roommates]
  );

  const getRoomById = useCallback(
    (id: string) => state.settings.rooms.find((r) => r.id === id),
    [state.settings.rooms]
  );

  const castVote = useCallback((requestId: string, vote: ApprovalVote) => {
    dispatch({ type: 'CAST_VOTE', payload: { requestId, vote } });
  }, []);

  const finalizeApproval = useCallback(
    (requestId: string, status: 'approved' | 'rejected') => {
      dispatch({ type: 'UPDATE_APPROVAL_STATUS', payload: { requestId, status } });
    },
    []
  );

  const settleMonth = useCallback((label: string) => {
    dispatch({ type: 'SETTLE_MONTH', payload: label });
  }, []);

  const addSharedGrocery = useCallback((item: SharedGroceryItem) => {
    dispatch({ type: 'ADD_SHARED_GROCERY', payload: item });
  }, []);

  const removeSharedGrocery = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_SHARED_GROCERY', payload: id });
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        addExpense,
        removeExpense,
        updateExpense,
        completeSetup,
        addRoommate,
        removeRoommate,
        updateRoommate,
        addRoom,
        removeRoom,
        updateRoom,
        updateSettings,
        resetAll,
        setActiveRoommate,
        getRoommateById,
        getRoomById,
        castVote,
        finalizeApproval,
        settleMonth,
        addSharedGrocery,
        removeSharedGrocery,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}