import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Expense, ExpenseCategory, SplitType, ExpenseScope } from '../types';
import { CURRENCIES } from '../types';
import { formatCurrency, formatDate, getCategoryLabel, CategoryIcon, CheckCircleSVG } from '../utils/format';
import { ChevronDown, ChevronUp, Filter, Edit3, Trash2, Save } from 'lucide-react';

const CATEGORIES: ExpenseCategory[] = [
  'groceries', 'electricity', 'water', 'gas', 'internet', 'rent', 'utilities', 'other',
];

function formatUsage(amount: number, unit: string | null | undefined): string {
  if (!unit || unit === 'units') {
    // If no specific unit provided, show as "X units"
    return `${amount} units`;
  }
  const lower = unit.toLowerCase();
  if (lower === 'minutes' || lower === 'min' || lower === 'minute') {
    const hours = amount / 60;
    if (hours < 1) return `${amount} min`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h} hour${h !== 1 ? 's' : ''}`;
    return `${h}h ${m}m`;
  }
  // Hours, kWh, etc. — keep original formatting
  return `${amount} ${unit}`;
}

function ExpenseCard({ expense, onEdit, onDelete }: { expense: Expense; onEdit: (e: Expense) => void; onDelete: (id: string) => void }) {
  const { state } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editAmount, setEditAmount] = useState(String(expense.amount));
  const [editCategory, setEditCategory] = useState(expense.category);
  const [editNote, setEditNote] = useState(expense.note);
  const [editSplitType, setEditSplitType] = useState<SplitType>(expense.splitType);
  const [editScope, setEditScope] = useState<ExpenseScope>(expense.scope);

  const payer = state.settings.roommates.find((r) => r.id === expense.paidBy);
  const isPending = expense.approvalStatus === 'pending_approval';

  const handleSaveEdit = () => {
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) return;
    onEdit({
      ...expense,
      amount,
      category: editCategory,
      note: editNote.trim() || expense.note,
      splitType: editSplitType,
      scope: editScope,
      requiresReapproval: expense.approvalStatus === 'approved',
      approvalStatus: expense.approvalStatus === 'approved' ? 'pending_approval' : expense.approvalStatus,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-white rounded-xl shadow-card p-4 animate-fade-slide-in">
        <div className="space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-900 font-semibold text-sm">{CURRENCIES[state.settings.currency].symbol}</span>
            <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2 bg-muted rounded-xl border border-border focus:border-primary outline-none text-green-900 text-sm tabular-nums" step="0.01" min="0" autoFocus />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setEditCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                  editCategory === cat ? 'bg-primary text-white' : 'bg-muted text-foreground/70'
                }`}>{getCategoryLabel(cat)}</button>
            ))}
          </div>
          <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)}
            className="w-full px-3 py-2 bg-muted rounded-xl border border-border focus:border-primary outline-none text-green-900 text-sm"
            placeholder="Note" maxLength={100} />
          <div className="flex gap-2">
            <select value={editSplitType} onChange={(e) => setEditSplitType(e.target.value as SplitType)}
              className="flex-1 px-2 py-1.5 bg-muted rounded-lg text-xs text-green-900 border border-border outline-none focus:border-primary">
              <option value="equal">Equal Split</option>
              <option value="usage">Usage-based</option>
            </select>
            <select value={editScope} onChange={(e) => setEditScope(e.target.value as ExpenseScope)}
              className="flex-1 px-2 py-1.5 bg-muted rounded-lg text-xs text-green-900 border border-border outline-none focus:border-primary">
              <option value="collective">Collective</option>
              <option value="individual">Individual</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)}
              className="flex-1 py-2 rounded-xl bg-muted text-foreground text-xs font-medium hover:bg-border transition-all cursor-pointer">Cancel</button>
            <button onClick={handleSaveEdit}
              className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary-hover active:scale-[0.97] transition-all cursor-pointer flex items-center justify-center gap-1">
              <Save className="w-3.5 h-3.5" /> Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-card p-4 animate-fade-slide-in ${isPending ? 'border-l-2 border-gold' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 animate-icon-pop">
            <CategoryIcon category={expense.category} className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-green-900 truncate flex items-center gap-1.5">
              {expense.note}
              {expense.scope === 'individual' && <span className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full font-normal">Individual</span>}
              {isPending && <span className="text-[9px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full font-normal">Pending</span>}
              {expense.approvalStatus === 'approved' && <CheckCircleSVG className="w-3.5 h-3.5 text-accent" />}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-foreground/60">{formatDate(expense.timestamp)}</span>
              <span className="text-[11px] text-foreground/40">&bull;</span>
              <span className="text-[11px] text-foreground/60">{getCategoryLabel(expense.category)}</span>
              {payer && <><span className="text-[11px] text-foreground/40">&bull;</span><span className="text-[11px] text-foreground/60">{payer.name}</span></>}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="text-base font-semibold text-green-900 tabular-nums">{formatCurrency(expense.amount)}</p>
          <span className={`text-[10px] font-medium ${expense.splitType === 'usage' ? 'text-accent' : 'text-foreground/50'}`}>
            {expense.splitType === 'usage' ? 'usage' : 'equal'}
          </span>
        </div>
      </div>

      {expanded && expense.usageAmount != null && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-foreground">Usage: {formatUsage(expense.usageAmount, expense.usageUnit)}</p>
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border flex gap-2">
          <button onClick={() => { setEditAmount(String(expense.amount)); setEditCategory(expense.category); setEditNote(expense.note); setEditSplitType(expense.splitType); setEditScope(expense.scope); setEditing(true); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-xs text-foreground/70 hover:text-primary transition-all cursor-pointer">
            <Edit3 className="w-3.5 h-3.5" /> Edit</button>
          <button onClick={() => onDelete(expense.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/10 text-xs text-destructive hover:bg-destructive/20 transition-all cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" /> Delete</button>
        </div>
      )}

      <button onClick={() => setExpanded(!expanded)}
        className="mt-2 w-full flex items-center justify-center text-foreground/40 hover:text-foreground/70 transition-all cursor-pointer py-1">
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function ExpenseHistory() {
  const { state, removeExpense, updateExpense } = useApp();
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'all'>('all');
  const [filterRoommate, setFilterRoommate] = useState<string | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  let filtered = state.expenses;
  if (filterCategory !== 'all') filtered = filtered.filter((e) => e.category === filterCategory);
  if (filterRoommate !== 'all') filtered = filtered.filter((e) => e.paidBy === filterRoommate);

  const groups: Record<string, Expense[]> = {};
  filtered.forEach((e) => {
    const d = new Date(e.timestamp);
    const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  return (
    <div className="space-y-3">
      <button onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition-all cursor-pointer px-1">
        <Filter className="w-4 h-4" /> <span>Filters</span>
        {(filterCategory !== 'all' || filterRoommate !== 'all') && <span className="w-2 h-2 rounded-full bg-accent" />}
      </button>

      {showFilters && (
        <div className="bg-white rounded-xl shadow-card p-4 space-y-3 animate-fade-slide-in">
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={filterCategory === 'all'} onClick={() => setFilterCategory('all')}>All</FilterChip>
              {CATEGORIES.map((cat) => (<FilterChip key={cat} active={filterCategory === cat} onClick={() => setFilterCategory(cat)}>{getCategoryLabel(cat)}</FilterChip>))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Roommate</label>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={filterRoommate === 'all'} onClick={() => setFilterRoommate('all')}>All</FilterChip>
              {state.settings.roommates.map((rm) => (<FilterChip key={rm.id} active={filterRoommate === rm.id} onClick={() => setFilterRoommate(rm.id)}>{rm.name}</FilterChip>))}
            </div>
          </div>
        </div>
      )}

      {Object.keys(groups).length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 animate-gentle-bob">
            <CategoryIcon category="other" className="w-7 h-7 text-foreground/30" />
          </div>
          <p className="text-foreground text-sm">No expenses yet</p>
          <p className="text-foreground/50 text-xs mt-1">Tap the mic or + to add your first expense</p>
        </div>
      ) : (
        Object.entries(groups).map(([date, expenses]) => (
          <div key={date}>
            <p className="text-[11px] font-medium text-foreground/50 uppercase tracking-wider mb-2 px-1">{date}</p>
            <div className="space-y-2">
              {expenses.map((e) => (<ExpenseCard key={e.id} expense={e} onEdit={(exp) => updateExpense(exp)} onDelete={(id) => removeExpense(id)} />))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
        active ? 'bg-primary text-white' : 'bg-muted text-foreground hover:bg-green-300/30'
      }`}>{children}</button>
  );
}