import type { CurrencyCode, ExpenseCategory } from '../types';
import { CURRENCIES } from '../types';

export function formatCurrency(amount: number, currency?: CurrencyCode): string {
  const cfg = currency ? CURRENCIES[currency] : CURRENCIES.INR;
  return `${cfg.symbol}${Math.round(amount).toLocaleString(cfg.locale)}`;
}

export function formatCurrencyExact(amount: number, currency?: CurrencyCode): string {
  const cfg = currency ? CURRENCIES[currency] : CURRENCIES.INR;
  return `${cfg.symbol}${amount.toLocaleString(cfg.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return `Today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getCategoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/* ── SVG Category Icons (replacing emojis) ── */

export function CategoryIcon({ category, className = 'w-5 h-5' }: { category: string; className?: string }) {
  const props = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (category as ExpenseCategory) {
    case 'groceries':
      return <svg {...props}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>;
    case 'electricity':
      return <svg {...props}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
    case 'water':
      return <svg {...props}><path d="M12 2a8 8 0 00-8 8c0 5 4 10 8 12 4-2 8-7 8-12a8 8 0 00-8-8z" /><path d="M12 11a3 3 0 100-6 3 3 0 000 6z" /></svg>;
    case 'gas':
      return <svg {...props}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="20" y2="22" /></svg>;
    case 'internet':
      return <svg {...props}><path d="M12 2a10 10 0 00-7.07 17.07l1.41-1.41A8 8 0 1112 20" /><path d="M12 6a6 6 0 00-4.24 10.24l1.41-1.41A4 4 0 1112 14" /><circle cx="12" cy="18" r="2" /></svg>;
    case 'rent':
      return <svg {...props}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
    case 'utilities':
      return <svg {...props}><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
  }
}

/* ── SVG icons for common UI (replacing emojis in settled states etc.) ── */

export function CheckCircleSVG({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>;
}

export function PartyPopperSVG({ className = 'w-6 h-6' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.8 11.3L2 22l10.7-3.79" /><path d="M4 3h.01" /><path d="M22 8h.01" /><path d="M15 2h.01" /><path d="M22 20h.01" /><path d="M15 19l-2.5-3.5" /><path d="M9 11.5l4 1" /><path d="M18 12.5l1.5-2" /><path d="M11 7l-2 2" /></svg>;
}

export function SparklesSVG({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.91 5.09L19 10l-5.09 1.91L12 17l-1.91-5.09L5 10l5.09-1.91z" /><path d="M20 14l.96 2.04L23 17l-2.04.96L20 20l-.96-2.04L17 17l2.04-.96z" /><path d="M4 14l.96 2.04L7 17l-2.04.96L4 20l-.96-2.04L1 17l2.04-.96z" /></svg>;
}

/* ── Color Palette ── */

export const ROOMMATE_COLORS = [
  '#1B7A4D', // green-700
  '#2FAE6B', // green-500
  '#0D9488', // teal
  '#8FD9B0', // green-300
  '#D97706', // amber
  '#6366F1', // indigo
  '#EC4899', // pink
  '#14B8A6', // teal-light
];

export function getRoommateColor(index: number): string {
  return ROOMMATE_COLORS[index % ROOMMATE_COLORS.length];
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}