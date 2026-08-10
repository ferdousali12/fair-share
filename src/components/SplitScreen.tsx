import { useState, useMemo, useCallback, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { calculateSplit } from '../utils/splitter';
import { formatCurrencyExact, CategoryIcon, PartyPopperSVG, CheckCircleSVG } from '../utils/format';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { CalendarDays, Share2, ArrowRight, Check } from 'lucide-react';
import { isMonthSettled } from '../utils/reconciler';
import { generateId } from '../utils/format';
import { CURRENCIES } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

/* ── Confetti particle component ── */
function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<{ id: string; x: number; delay: number; color: string; size: number }[]>([]);

  useEffect(() => {
    if (!active) return;
    const colors = ['#2FAE6B', '#0D9488', '#D97706', '#6366F1', '#EC4899', '#14B8A6', '#1B7A4D'];
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: generateId() + i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6,
    }));
    setParticles(newParticles);
    const timer = setTimeout(() => setParticles([]), 2000);
    return () => clearTimeout(timer);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div key={p.id}
          className="absolute rounded-full animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${1 + Math.random() * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function SplitScreen() {
  const { state, settleMonth } = useApp();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showConfetti, setShowConfetti] = useState(false);

  const result = useMemo(
    () => calculateSplit(state.expenses, state.settings.roommates, state.settings, selectedMonth, selectedYear),
    [state.expenses, state.settings, selectedMonth, selectedYear]
  );

  const monthLabel = result.monthLabel;
  const alreadySettled = isMonthSettled(state.settledMonths, selectedMonth, selectedYear);
  const hasSettled = result.transactions.length === 0 && result.totalExpenses > 0;

  const handleSettle = useCallback(() => {
    settleMonth(monthLabel);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2500);
  }, [settleMonth, monthLabel]);

  const handleShare = () => {
    let message = `🏠 *Fair Share — ${result.monthLabel}*\n\n`;
    result.perPerson.forEach((p) => {
      const sign = p.netBalance >= 0 ? '+' : '';
      message += `${p.name}: ${sign}${formatCurrencyExact(p.netBalance)}\n`;
    });
    message += `\n*Total: ${formatCurrencyExact(result.totalExpenses)}*\n\n*Settle Up:*\n`;
    result.transactions.forEach((t) => {
      message += `• ${t.fromName} → ${t.toName}: ${formatCurrencyExact(t.amount)}\n`;
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const donutColors = result.perPerson.map((p) => p.color);
  const donutData = {
    labels: result.perPerson.map((p) => p.name),
    datasets: [{
      data: result.perPerson.every((p) => Math.abs(p.netBalance) < 0.01) ? [1] : result.perPerson.map((p) => Math.max(0, p.netBalance)),
      backgroundColor: result.perPerson.every((p) => Math.abs(p.netBalance) < 0.01) ? ['#E4F7EC'] : donutColors,
      borderWidth: 0,
      hoverOffset: 8,
    }],
  };

  const barData = {
    labels: result.perPerson.map((p) => p.name),
    datasets: [
      { label: 'Paid', data: result.perPerson.map((p) => p.totalPaid), backgroundColor: result.perPerson.map((p) => p.color + '80'), borderRadius: 6 },
      { label: 'Owes', data: result.perPerson.map((p) => p.totalOwes), backgroundColor: result.perPerson.map((p) => p.color), borderRadius: 6 },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top' as const, labels: { boxWidth: 12, padding: 12, font: { size: 11 } } } },
    scales: {
      y: { beginAtZero: true, ticks: { font: { size: 10 }, callback: (v: any) => `${CURRENCIES[state.settings.currency].symbol}${v}` }, grid: { color: 'oklch(0.92 0.02 145)' } },
      x: { ticks: { font: { size: 10 } }, grid: { display: false } },
    },
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: { legend: { display: true, position: 'bottom' as const, labels: { boxWidth: 12, padding: 12, font: { size: 11 } } } },
  };

  const changeMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  return (
    <div className="px-4 pt-4 pb-32 max-w-lg mx-auto">
      <Confetti active={showConfetti} />

      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-bold text-green-900">Split</h2>
        <div className="flex items-center gap-2">
          {result.totalExpenses > 0 && (
            <button onClick={handleShare}
              className="flex items-center gap-1.5 bg-primary text-white text-xs font-medium px-3 py-1.5 rounded-full hover:bg-primary-hover active:scale-[0.97] transition-all cursor-pointer">
              <Share2 className="w-3.5 h-3.5" /> <span>Share</span>
            </button>
          )}
          {result.totalExpenses > 0 && !alreadySettled && (
            <button onClick={handleSettle}
              className="flex items-center gap-1.5 bg-accent/20 text-accent text-xs font-medium px-3 py-1.5 rounded-full hover:bg-accent/30 active:scale-[0.97] transition-all cursor-pointer">
              <Check className="w-3.5 h-3.5" /> <span>Settle</span>
            </button>
          )}
          {alreadySettled && (
            <span className="flex items-center gap-1 text-xs text-accent font-medium">
              <CheckCircleSVG className="w-4 h-4" /> Settled
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between bg-white rounded-xl shadow-card px-4 py-3 mb-5">
        <button onClick={() => changeMonth(-1)}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-all cursor-pointer" aria-label="Previous month">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="font-medium text-green-900 text-sm">{monthLabel}</span>
        </div>
        <button onClick={() => changeMonth(1)}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-all cursor-pointer" aria-label="Next month">
          <ArrowRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {result.totalExpenses === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4 animate-gentle-bob">
            <CategoryIcon category="utilities" className="w-8 h-8 text-foreground/30" />
          </div>
          <p className="text-foreground font-medium">No expenses this month</p>
          <p className="text-foreground/50 text-sm mt-1">Add expenses on the Dashboard to see the split</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-card p-5 text-center">
            <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider mb-1">Total Expenses</p>
            <p className="text-3xl font-bold text-green-900 tabular-nums font-heading">{formatCurrencyExact(result.totalExpenses)}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-card p-5">
            <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider mb-3">Balance Breakdown</p>
            <div className="h-48"><Doughnut data={donutData} options={donutOptions} /></div>
          </div>

          <div className="bg-white rounded-2xl shadow-card p-5">
            <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider mb-3">Paid vs Owes</p>
            <div className="h-48"><Bar data={barData} options={barOptions} /></div>
          </div>

          <div className="bg-white rounded-2xl shadow-card p-5">
            <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider mb-3">Who owes whom</p>
            <div className="space-y-3">
              {result.perPerson.map((p) => (
                <div key={p.roommateId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-sm font-medium text-green-900">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold tabular-nums ${p.netBalance > 0 ? 'text-gold' : p.netBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>
                      {p.netBalance > 0 ? '+' : ''}{formatCurrencyExact(p.netBalance)}
                    </p>
                    <p className="text-[10px] text-foreground/50">Paid: {formatCurrencyExact(p.totalPaid)} • Owes: {formatCurrencyExact(p.totalOwes)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {result.transactions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-card p-5">
              <p className="text-xs font-medium text-foreground/60 uppercase tracking-wider mb-3">Settle Up</p>
              <div className="space-y-2.5">
                {result.transactions.map((t, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted rounded-xl px-4 py-3 animate-fade-slide-in" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-green-900">{t.fromName}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-foreground/40" />
                      <span className="font-medium text-green-900">{t.toName}</span>
                    </div>
                    <span className="font-semibold text-green-900 tabular-nums text-sm">{formatCurrencyExact(t.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settled state */}
          {hasSettled && !alreadySettled && (
            <div className="bg-accent/10 rounded-2xl p-5 text-center">
              <PartyPopperSVG className="w-8 h-8 text-accent mx-auto mb-2" />
              <p className="text-accent font-semibold">All settled up!</p>
              <p className="text-foreground/60 text-sm mt-1">No one owes anyone — tap "Settle" above to close the month</p>
            </div>
          )}

          {alreadySettled && (
            <div className="bg-accent/10 rounded-2xl p-5 text-center">
              <CheckCircleSVG className="w-8 h-8 text-accent mx-auto mb-2" />
              <p className="text-accent font-semibold">{monthLabel} is settled!</p>
              <p className="text-foreground/60 text-sm mt-1">This month is closed</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArrowLeft({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>;
}