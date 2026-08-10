import type { Expense, FlatSettings, SplitResult } from '../types';

interface PerPersonSummary {
  roommateId: string;
  name: string;
  color: string;
  totalPaid: number;
  totalOwes: number;
  netBalance: number;
}

export function calculateSplit(
  expenses: Expense[],
  roommates: FlatSettings['roommates'],
  _settings: FlatSettings,
  month: number,
  year: number
): SplitResult {
  const monthExpenses = expenses.filter((e) => {
    const d = new Date(e.timestamp);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const roommateCount = roommates.length;
  if (roommateCount === 0) {
    return emptyResult(roommates, month, year);
  }

  // 1. Separate expenses by scope and category
  const collectiveExpenses = monthExpenses.filter((e) => e.scope === 'collective');
  const individualExpenses = monthExpenses.filter((e) => e.scope === 'individual');
  const electricityExpenses = collectiveExpenses.filter((e) => e.category === 'electricity');

  // 2. Calculate total tracked AC costs (individual electricity → personal AC usage)
  const totalTrackedACCosts = individualExpenses
    .filter((e) => e.category === 'electricity')
    .reduce((sum, e) => sum + (e.calculatedAmount ?? e.amount), 0);

  // 3. Build per-person paid map
  const paidMap = new Map<string, number>();
  for (const r of roommates) paidMap.set(r.id, 0);

  for (const e of monthExpenses) {
    // Only count what the person actually paid out-of-pocket for collective items
    // Individual AC expenses count toward their paid amount
    if (e.approvalStatus === 'approved') {
      paidMap.set(e.paidBy, (paidMap.get(e.paidBy) || 0) + (e.calculatedAmount ?? e.amount));
    }
  }

  // 4. Calculate what each person owes
  const personOwes = new Map<string, number>();
  for (const r of roommates) personOwes.set(r.id, 0);

  // ── Collective expenses (non-electricity) split equally ──
  const nonElectricCollective = collectiveExpenses.filter((e) => e.category !== 'electricity');
  for (const e of nonElectricCollective) {
    if (e.approvalStatus !== 'approved') continue;
    const share = e.amount / roommateCount;
    for (const r of roommates) {
      personOwes.set(r.id, (personOwes.get(r.id) || 0) + share);
    }
  }

  // ── Electricity expenses: use reconciliation equation ──
  if (electricityExpenses.length > 0) {
    // Total electricity bill = sum of all collective electricity expenses
    const totalElectricityBill = electricityExpenses
      .filter((e) => e.approvalStatus === 'approved')
      .reduce((sum, e) => sum + e.amount, 0);

    // Baseline Shared Bill = Total Bill - Tracked AC Costs
    const baselineSharedBill = Math.max(0, totalElectricityBill - totalTrackedACCosts);
    const sharedPerPerson = baselineSharedBill / roommateCount;

    for (const r of roommates) {
      // Person's tracked AC cost (individual electricity they logged)
      const personACKCost = individualExpenses
        .filter((e) => e.category === 'electricity' && e.paidBy === r.id && e.approvalStatus === 'approved')
        .reduce((sum, e) => sum + (e.calculatedAmount ?? e.amount), 0);

      // Final charge = AC cost + shared baseline
      const finalCharge = personACKCost + sharedPerPerson;

      // The person who paid the bill gets credit for the total, but owes their share
      // Everyone else just owes their share
      personOwes.set(r.id, (personOwes.get(r.id) || 0) + finalCharge);
    }
  }

  // 5. Calculate net balance for each person
  const perPerson: PerPersonSummary[] = [];
  let totalExpenses = 0;

  for (const r of roommates) {
    const paid = paidMap.get(r.id) || 0;
    const owes = personOwes.get(r.id) || 0;
    const net = paid - owes;
    totalExpenses += paid;
    perPerson.push({
      roommateId: r.id,
      name: r.name,
      color: r.color,
      totalPaid: paid,
      totalOwes: owes,
      netBalance: net,
    });
  }

  // 6. Greedy debt minimization
  const debtors = perPerson
    .filter((p) => p.netBalance < -0.01)
    .map((p) => ({ id: p.roommateId, name: p.name, amount: -p.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = perPerson
    .filter((p) => p.netBalance > 0.01)
    .map((p) => ({ id: p.roommateId, name: p.name, amount: p.netBalance }))
    .sort((a, b) => b.amount - a.amount);

  const transactions: SplitResult['transactions'] = [];

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settled = Math.min(debtor.amount, creditor.amount);

    if (settled > 0.01) {
      transactions.push({
        from: debtor.id,
        fromName: debtor.name,
        to: creditor.id,
        toName: creditor.name,
        amount: Math.round(settled * 100) / 100,
      });
    }

    debtor.amount -= settled;
    creditor.amount -= settled;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = `${monthNames[month]} ${year}`;

  return {
    totalExpenses: collectiveExpenses
      .filter((e) => e.approvalStatus === 'approved')
      .reduce((s, e) => s + e.amount, 0),
    perPerson,
    transactions,
    monthLabel,
  };
}

function emptyResult(roommates: FlatSettings['roommates'], month: number, year: number): SplitResult {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    totalExpenses: 0,
    perPerson: roommates.map((r) => ({
      roommateId: r.id,
      name: r.name,
      color: r.color,
      totalPaid: 0,
      totalOwes: 0,
      netBalance: 0,
    })),
    transactions: [],
    monthLabel: `${monthNames[month]} ${year}`,
  };
}