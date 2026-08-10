import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { ExpenseCategory, SplitType } from '../types';
import { CURRENCIES } from '../types';
import { getCategoryLabel } from '../utils/format';
import { X, Check } from 'lucide-react';

interface QuickAddFormProps {
  onClose: () => void;
  onConfirm: (expense: { amount: number; category: ExpenseCategory; note: string; splitType: SplitType }) => void;
  initialData?: { amount: number | null; category: ExpenseCategory; note: string; splitType: SplitType };
}

const CATEGORIES: ExpenseCategory[] = [
  'groceries', 'electricity', 'water', 'gas', 'internet', 'rent', 'utilities', 'other',
];

export default function QuickAddForm({ onClose, onConfirm, initialData }: QuickAddFormProps) {
  const { state } = useApp();
  const [amount, setAmount] = useState(initialData?.amount ? String(initialData.amount) : '');
  const [category, setCategory] = useState<ExpenseCategory>(initialData?.category || 'groceries');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const amountValue = amount ? parseFloat(amount.replace(/,/g, '')) : 0;

  const handleSubmit = () => {
    setError('');

    if (!amountValue || amountValue <= 0) {
      setError('Enter a valid amount');
      return;
    }

    onConfirm({
      amount: amountValue,
      category,
      note: note.trim() || initialData?.note || `${getCategoryLabel(category)} expense`,
      splitType: category === 'rent' ? 'equal' : 'equal',
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-auto p-6 animate-slide-up shadow-xl">
        {/* Handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-lg font-semibold text-green-900">
            {initialData ? 'Confirm Expense' : 'Add Expense'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-all cursor-pointer" aria-label="Close">
            <X className="w-4 h-4 text-foreground" />
          </button>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-2.5 rounded-xl mb-4">
            {error}
          </div>
        )}

        {/* Amount Input */}
        <div className="mb-4">
          <label className="text-sm font-medium text-green-900 mb-1.5 block">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-900 font-semibold">{CURRENCIES[state.settings.currency].symbol}</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full pl-9 pr-4 py-3 bg-muted rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-green-900 text-lg font-semibold tabular-nums"
              autoFocus
              step="0.01"
              min="0"
            />
          </div>
        </div>

        {/* Category Picker */}
        <div className="mb-4">
          <label className="text-sm font-medium text-green-900 mb-1.5 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  category === cat
                    ? 'bg-primary text-white'
                    : 'bg-muted text-foreground hover:bg-green-300/30'
                }`}
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="mb-5">
          <label className="text-sm font-medium text-green-900 mb-1.5 block">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={initialData?.note || 'What was this for?'}
            className="w-full px-4 py-2.5 bg-muted rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-green-900 placeholder:text-foreground/40 text-sm"
            maxLength={100}
          />
        </div>

        {/* Paying as */}
        <div className="mb-5">
          <label className="text-sm font-medium text-green-900 mb-1.5 block">Paid by</label>
          <div className="flex flex-wrap gap-2">
            {state.settings.roommates.map((rm) => (
              <div
                key={rm.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-foreground"
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: rm.color || '#1B7A4D' }}
                />
                <span>{rm.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Confirm */}
        <button
          onClick={handleSubmit}
          className="w-full bg-primary text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-[0.97] transition-all cursor-pointer shadow-card"
        >
          <Check className="w-4 h-4" />
          <span>{initialData ? 'Confirm' : 'Add Expense'}</span>
        </button>
      </div>
    </div>
  );
}