import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import type { ParsedExpense, ExpenseCategory, SplitType, ExpenseScope, ACType, ElectricityBillResult } from '../types';
import VoiceInput from './VoiceInput';
import QuickAddForm from './QuickAddForm';
import ExpenseHistory from './ExpenseHistory';
import ApprovalRequests from './ApprovalRequests';
import { formatCurrencyExact, formatCurrency } from '../utils/format';
import { getACKWRate, detectACType, extractUsageHours, isACRelated } from '../utils/acCalculator';
import { calculateElectricityBill } from '../utils/electricityBill';
import { Plus, Check, Bell, Calculator, X, Zap, Loader2 } from 'lucide-react';
import { CURRENCIES } from '../types';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info';
}

export default function Dashboard() {
  const { state, setActiveRoommate, addExpense } = useApp();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [pendingParsed, setPendingParsed] = useState<ParsedExpense | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showRoommateSwitcher, setShowRoommateSwitcher] = useState(false);
  const [countUpValue, setCountUpValue] = useState(0);
  const prevTotalRef = useRef(0);

  // ── Bill Calculator state ──
  const [showBillCalc, setShowBillCalc] = useState(false);
  const [meterUnits, setMeterUnits] = useState('');
  const [calcResult, setCalcResult] = useState<ElectricityBillResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState('');

  const activeRoommate = state.settings.roommates.find((r) => r.id === state.activeRoommateId);

  const now = new Date();
  const thisMonthExpenses = state.expenses.filter((e) => {
    const d = new Date(e.timestamp);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // ── TOTAL PAID OUT-OF-POCKET BY ME ──
  const totalPaidByMe = thisMonthExpenses
    .filter((e) => e.paidBy === state.activeRoommateId && e.approvalStatus === 'approved')
    .reduce((s, e) => s + (e.calculatedAmount ?? e.amount), 0);

  const pendingCount = state.approvalRequests.filter((r) => r.status === 'pending_approval').length;

  // Count-up animation
  useEffect(() => {
    const prev = prevTotalRef.current;
    prevTotalRef.current = totalPaidByMe;
    if (prev === totalPaidByMe) return;

    const start = prev;
    const end = totalPaidByMe;
    const duration = 800;
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setCountUpValue(current);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [totalPaidByMe]);

  useEffect(() => { setCountUpValue(totalPaidByMe); }, []);

  const showToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    const id = Date.now().toString(36);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  // ── Bill Calculator handlers ──

  const handleCalculateBill = useCallback(async () => {
    setCalcError('');
    setCalcResult(null);
    const units = parseFloat(meterUnits);
    if (!units || units <= 0) {
      setCalcError('Enter a valid number of units');
      return;
    }

    const activeRoom = state.settings.rooms.find((r) => r.id === activeRoommate?.roomId);
    const phase = activeRoom?.connectionPhase ?? 'single';
    const consumerStatus = state.settings.consumerStatus ?? 'protected';

    setCalcLoading(true);
    try {
      const result = await calculateElectricityBill(units, consumerStatus, phase);
      setCalcResult(result);
    } catch (err: any) {
      setCalcError(err.message || 'Failed to calculate bill');
    } finally {
      setCalcLoading(false);
    }
  }, [meterUnits, state.settings, activeRoommate]);

  const handleAddCalculatedBill = useCallback(() => {
    if (!calcResult || !state.activeRoommateId) return;
    const activeRoom = state.settings.rooms.find((r) => r.id === activeRoommate?.roomId);

    addExpense({
      amount: calcResult.totalBill,
      category: 'electricity',
      paidBy: state.activeRoommateId,
      note: `Electricity bill (${calcResult.totalUnits} units × Rs.${calcResult.ratePerKWh}/kWh, ${calcResult.consumerStatus}, ${activeRoom?.connectionPhase ?? 'single'}-phase) — ${calcResult.tariffSource === 'live' ? 'Live IESCO tariff' : 'Fallback tariff'}`,
      splitType: 'equal',
      scope: 'collective',
      approvalStatus: 'pending_approval',
    });

    setShowBillCalc(false);
    setMeterUnits('');
    setCalcResult(null);
    showToast(`Electricity bill: ${formatCurrencyExact(calcResult.totalBill)}`);
  }, [calcResult, state.activeRoommateId, state.settings, activeRoommate, addExpense, showToast]);

  const handleVoiceResult = useCallback(async (parsed: ParsedExpense) => {
    if (!state.activeRoommateId) return;

    const { amount, category, note, splitType, scope, usageAmount, usageUnit, usageHours } = parsed;
    const activeRoommate = state.settings.roommates.find((r) => r.id === state.activeRoommateId);

    // ── Check if this is an "electricity N units" bill (calculate from tariff) ──
    const isUnitBill = category === 'electricity'
      && usageUnit === 'units'
      && usageAmount != null
      && usageAmount > 0
      && (amount === null || amount <= 0);

    if (isUnitBill) {
      const activeRoom = state.settings.rooms.find((r) => r.id === activeRoommate?.roomId);
      const phase = activeRoom?.connectionPhase ?? 'single';
      const consumerStatus = state.settings.consumerStatus ?? 'protected';
      const units = usageAmount;

      showToast(`Calculating bill for ${units} units...`, 'info');
      try {
        const result = await calculateElectricityBill(units, consumerStatus, phase);
        addExpense({
          amount: result.totalBill,
          category: 'electricity',
          paidBy: state.activeRoommateId,
          note: `Electricity bill (${result.totalUnits} units × Rs.${result.ratePerKWh}/kWh) — ${result.tariffSource === 'live' ? 'Live IESCO tariff' : 'Fallback tariff'}`,
          splitType: 'equal',
          scope: 'collective',
          approvalStatus: 'pending_approval',
        });
        showToast(`Bill: ${formatCurrencyExact(result.totalBill)} (${result.totalUnits} units @ Rs.${result.ratePerKWh}/kWh)`);
      } catch (err: any) {
        showToast(`Could not calculate bill: ${err.message}`, 'info');
      }
      return;
    }

    // ── Backend AC Auto-Calculation ──
    let finalAmount = amount;
    let finalCalculatedAmount: number | undefined;
    let finalScope: ExpenseScope = scope;
    let finalNote = note;

    // Check if this needs AC auto-calculation
    const isACCategory = category === 'electricity' || isACRelated(note);
    const needsCalc = isACCategory && (amount === null || amount <= 0);

    if (needsCalc) {
      // Get AC hours from transcript or parsed data
      const acHours = usageHours ?? extractUsageHours(note) ?? null;

      if (acHours && acHours > 0) {
        // Find the user's room to get AC type
        const activeRoom = state.settings.rooms.find((r) => r.id === activeRoommate?.roomId);
        const acType: ACType = activeRoom?.acType ?? detectACType(note);
        const rate = state.settings.electricityRate || 50;
        const kwRate = getACKWRate(acType);

        finalCalculatedAmount = Math.round(acHours * kwRate * rate * 100) / 100;
        finalAmount = finalCalculatedAmount;
        finalScope = 'individual'; // AC usage is individual tracking
        finalNote = `${note} (${acHours}h × ${kwRate}kW × Rs.${rate}/kWh)`;
      } else {
        // No hours found, show toast to inform
        showToast('No AC hours detected. Try "AC 4 hours" or specify usage.', 'info');
        return;
      }
    }

    if (!finalAmount || finalAmount <= 0) {
      showToast('Could not determine the amount. Try again.', 'info');
      return;
    }

    addExpense({
      amount: finalAmount,
      category,
      paidBy: state.activeRoommateId,
      note: finalNote || `${category} expense`,
      splitType,
      scope: finalScope,
      approvalStatus: finalScope === 'individual' ? 'approved' : 'pending_approval',
      usageAmount,
      usageUnit,
      usageHours: usageHours ?? undefined,
      calculatedAmount: finalCalculatedAmount,
      roomId: activeRoommate?.roomId,
    });

    if (finalCalculatedAmount) {
      showToast(`AC usage calculated: ${formatCurrency(finalCalculatedAmount)}`);
    } else {
      showToast(`${category} — ${formatCurrency(finalAmount)} added`);
    }
  }, [state.activeRoommateId, state.settings, addExpense, showToast]);

  const handleQuickAddConfirm = useCallback(
    (data: { amount: number; category: ExpenseCategory; note: string; splitType: SplitType }) => {
      if (!state.activeRoommateId) return;

      const scope: ExpenseScope = pendingParsed?.scope === 'individual' ? 'individual' : 'collective';

      addExpense({
        amount: data.amount,
        category: data.category,
        paidBy: state.activeRoommateId,
        note: data.note,
        splitType: data.splitType,
        scope,
        approvalStatus: scope === 'individual' ? 'approved' : 'pending_approval',
        usageAmount: pendingParsed?.usageAmount,
        usageUnit: pendingParsed?.usageUnit,
        usageHours: pendingParsed?.usageHours,
        calculatedAmount: pendingParsed?.usageHours && data.amount > 0 ? data.amount : undefined,
      });

      setShowQuickAdd(false);
      setPendingParsed(null);
      showToast(`${data.category} — ${formatCurrency(data.amount)} added`);
    },
    [state.activeRoommateId, addExpense, showToast, pendingParsed]
  );

  useEffect(() => {
    if (pendingParsed) setShowQuickAdd(true);
  }, [pendingParsed]);

  const expenseCount = state.expenses.length;

  return (
    <div className="px-4 pt-4 pb-32 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-xl font-bold text-green-900">{state.settings.groupName || 'Fair Share'}</h1>
          <p className="text-xs text-foreground/50 mt-0.5">{expenseCount} expense{expenseCount !== 1 ? 's' : ''} logged</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <div className="relative">
              <Bell className="w-5 h-5 text-gold" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-gold text-white text-[8px] font-bold rounded-full flex items-center justify-center">{pendingCount}</span>
            </div>
          )}
          {/* Roommate Switcher */}
          <div className="relative">
            <button onClick={() => setShowRoommateSwitcher(!showRoommateSwitcher)}
              className="flex items-center gap-2 bg-white rounded-full shadow-card px-3 py-1.5 hover:shadow-card-hover transition-all cursor-pointer">
              {activeRoommate && (
                <>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: activeRoommate.color || '#1B7A4D' }}>
                    {activeRoommate.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-green-900">{activeRoommate.name}</span>
                </>
              )}
            </button>
            {showRoommateSwitcher && (
              <div className="absolute right-0 top-12 bg-white rounded-xl shadow-lg border border-border py-1 min-w-[160px] z-30 animate-fade-slide-in">
                {state.settings.roommates.map((rm) => (
                  <button key={rm.id}
                    onClick={() => { setActiveRoommate(rm.id); setShowRoommateSwitcher(false); }}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-all cursor-pointer ${
                      rm.id === state.activeRoommateId ? 'bg-muted text-primary font-medium' : 'text-green-900'
                    }`}>
                    <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: rm.color || '#1B7A4D' }} />
                    <span>{rm.name}</span>
                    {rm.id === state.activeRoommateId && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <div className="bg-white rounded-2xl shadow-card p-5 mb-5">
        <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider mb-1">
          {activeRoommate ? `${activeRoommate.name}'s Out-of-Pocket` : 'This Month'}
        </p>
        <p className="text-3xl font-bold text-green-900 tabular-nums font-heading">{formatCurrency(countUpValue)}</p>
        <p className="text-xs text-foreground/50 mt-1">{thisMonthExpenses.length} expense{thisMonthExpenses.length !== 1 ? 's' : ''} this month</p>

        {state.settings.roommates.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {state.settings.roommates.map((rm) => {
              const total = thisMonthExpenses
                .filter((e) => e.paidBy === rm.id && e.approvalStatus === 'approved')
                .reduce((s, e) => s + (e.calculatedAmount ?? e.amount), 0);
              const max = Math.max(...state.settings.roommates.map((r) =>
                thisMonthExpenses
                  .filter((e) => e.paidBy === r.id && e.approvalStatus === 'approved')
                  .reduce((s, e) => s + (e.calculatedAmount ?? e.amount), 0)), 1);
              return (
                <div key={rm.id} className="flex items-center gap-2">
                  <span className="text-[10px] text-foreground/60 w-14 truncate">{rm.name}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(total / max) * 100}%`, backgroundColor: rm.color || '#1B7A4D' }} />
                  </div>
                  <span className="text-[10px] font-medium text-foreground tabular-nums w-16 text-right">{formatCurrency(total)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approval Requests */}
      <ApprovalRequests />

      {/* Quick-add button */}
      <button onClick={() => { setPendingParsed(null); setShowQuickAdd(true); }}
        className="w-full bg-primary/10 text-primary font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 mb-3 hover:bg-primary/20 active:scale-[0.97] transition-all cursor-pointer text-sm">
        <Plus className="w-4 h-4" /> <span>Quick Add</span>
      </button>

      {/* Calculate Bill button */}
      <button onClick={() => { setMeterUnits(''); setCalcResult(null); setCalcError(''); setShowBillCalc(true); }}
        className="w-full bg-accent/10 text-accent font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 mb-5 hover:bg-accent/20 active:scale-[0.97] transition-all cursor-pointer text-sm">
        <Calculator className="w-4 h-4" /> <span>Calculate Bill</span>
      </button>

      {/* Expense History */}
      <ExpenseHistory />

      {/* Voice Input */}
      <VoiceInput onResult={handleVoiceResult} />

      {/* Bill Calculator Modal */}
      {showBillCalc && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowBillCalc(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 animate-slide-up shadow-xl">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-green-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" /> Calculate Electricity Bill
              </h2>
              <button onClick={() => setShowBillCalc(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-all cursor-pointer" aria-label="Close">
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>

            <p className="text-xs text-foreground/50 mb-4">
              Enter your meter units for the month. The bill is calculated from the live IESCO tariff
              ({state.settings.consumerStatus ?? 'protected'} consumer,
              {state.settings.rooms.find((r) => r.id === activeRoommate?.roomId)?.connectionPhase ?? 'single'}-phase connection).
            </p>

            {calcError && (
              <div className="bg-destructive/10 text-destructive text-sm px-4 py-2.5 rounded-xl mb-4">
                {calcError}
              </div>
            )}

            <div className="mb-4">
              <label className="text-sm font-medium text-green-900 mb-1.5 block">Meter Units</label>
              <div className="relative">
                <input
                  type="number"
                  value={meterUnits}
                  onChange={(e) => setMeterUnits(e.target.value)}
                  placeholder="e.g. 250"
                  className="w-full px-4 py-3 bg-muted rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-green-900 text-lg font-semibold tabular-nums"
                  autoFocus
                  min="0"
                  onKeyDown={(e) => e.key === 'Enter' && handleCalculateBill()}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/50 text-xs">units</span>
              </div>
            </div>

            <button
              onClick={handleCalculateBill}
              disabled={calcLoading}
              className="w-full bg-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-[0.97] transition-all cursor-pointer shadow-card disabled:opacity-60"
            >
              {calcLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              <span>{calcLoading ? 'Calculating...' : 'Calculate'}</span>
            </button>

            {calcResult && (
              <div className="mt-4 bg-muted rounded-xl p-4 animate-fade-slide-in">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground/50">Rate (slab {calcResult.slabUsed})</span>
                  <span className="text-sm font-semibold text-green-900 tabular-nums">Rs. {calcResult.ratePerKWh}/kWh</span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground/50">Energy charge ({calcResult.totalUnits} units)</span>
                  <span className="text-sm font-semibold text-green-900 tabular-nums">{CURRENCIES[state.settings.currency].symbol}{formatCurrencyExact(calcResult.energyCharge)}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-foreground/50">Fixed charge ({state.settings.rooms.find((r) => r.id === activeRoommate?.roomId)?.connectionPhase ?? 'single'}-phase)</span>
                  <span className="text-sm font-semibold text-green-900 tabular-nums">{CURRENCIES[state.settings.currency].symbol}{formatCurrencyExact(calcResult.fixedCharge)}</span>
                </div>
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-green-900">Total Bill</span>
                  <span className="text-xl font-bold text-primary tabular-nums font-heading">{CURRENCIES[state.settings.currency].symbol}{formatCurrencyExact(calcResult.totalBill)}</span>
                </div>
                <p className="text-[10px] text-foreground/40 mt-2">
                  {calcResult.tariffSource === 'live' ? 'Live IESCO tariff' : 'Fallback tariff data'} · {new Date(calcResult.tariffFetchedAt).toLocaleDateString()}
                </p>
                <button
                  onClick={handleAddCalculatedBill}
                  className="w-full mt-3 bg-accent text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer text-sm"
                >
                  <Check className="w-4 h-4" /> Add as collective expense
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QuickAdd Modal */}
      {showQuickAdd && (
        <QuickAddForm
          onClose={() => { setShowQuickAdd(false); setPendingParsed(null); }}
          onConfirm={handleQuickAddConfirm}
          initialData={pendingParsed ? {
            amount: pendingParsed.amount,
            category: pendingParsed.category,
            note: pendingParsed.note,
            splitType: pendingParsed.splitType,
          } : undefined}
        />
      )}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="bg-green-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-toast-in flex items-center gap-2">
            <Check className="w-4 h-4 text-accent" /> <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}