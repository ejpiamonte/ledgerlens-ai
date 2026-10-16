import { toUsd } from './scenarios';
import type { ExceptionKind, Invoice } from './types';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const usdOf = (i: Invoice) => i.totalUsd ?? toUsd(i.total, i.currency);
export const wasReviewed = (i: Invoice) => i.status !== 'auto_processed';
export const isOpen = (i: Invoice) => i.status === 'review_required';

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export type DailyPoint = { date: string; label: string; touchless: number; reviewed: number };

export function summarize(invoices: Invoice[], now = Date.now()) {
  const total = invoices.length;
  const touchless = invoices.filter((i) => i.status === 'auto_processed');
  const open = invoices.filter(isOpen);
  const decided = invoices.filter((i) => i.decidedAt);
  const spendUsd = invoices.reduce((sum, i) => sum + usdOf(i), 0);
  const touchlessSpendUsd = touchless.reduce((sum, i) => sum + usdOf(i), 0);

  const touchlessMs = median(touchless.map((i) => i.processingMs ?? 0).filter(Boolean));
  const reviewedMs = median(decided.map((i) => Date.parse(i.decidedAt!) - Date.parse(i.createdAt)));
  const oldestOpenMs = open.length ? Math.max(...open.map((i) => now - Date.parse(i.createdAt))) : 0;

  // 30-day daily volume, split by outcome.
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const daily: DailyPoint[] = Array.from({ length: 30 }, (_, k) => {
    const d = new Date(start.getTime() - (29 - k) * DAY);
    const key = d.toISOString().slice(0, 10);
    const rows = invoices.filter((i) => i.createdAt.slice(0, 10) === key);
    return {
      date: key,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      touchless: rows.filter((i) => i.status === 'auto_processed').length,
      reviewed: rows.filter(wasReviewed).length,
    };
  });

  const exceptionCounts = new Map<ExceptionKind, number>();
  for (const i of invoices)
    if (i.exception) exceptionCounts.set(i.exception, (exceptionCounts.get(i.exception) ?? 0) + 1);
  const exceptions = [...exceptionCounts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);

  const aging = [
    { label: 'Under 24 hours', count: 0, tone: 'green' as const },
    { label: '1–3 days', count: 0, tone: 'amber' as const },
    { label: 'Over 3 days', count: 0, tone: 'red' as const },
  ];
  for (const i of open) {
    const age = now - Date.parse(i.createdAt);
    aging[age < DAY ? 0 : age < 3 * DAY ? 1 : 2]!.count++;
  }

  const prevented = invoices.filter(
    (i) =>
      i.status === 'rejected' &&
      (i.exception === 'duplicate' || i.exception === 'suspicious' || i.exception === 'arithmetic'),
  );

  return {
    total,
    touchless: touchless.length,
    touchlessRate: total ? touchless.length / total : 0,
    touchlessSpendUsd,
    reviewed: total - touchless.length,
    open: open.length,
    openValueUsd: open.reduce((sum, i) => sum + usdOf(i), 0),
    rejected: invoices.filter((i) => i.status === 'rejected').length,
    spendUsd,
    touchlessMs,
    reviewedMs,
    oldestOpenMs,
    daily,
    exceptions,
    aging,
    preventedCount: prevented.length,
    preventedUsd: prevented.reduce((sum, i) => sum + usdOf(i), 0),
  };
}

export type VendorSummary = {
  name: string;
  category: string;
  count: number;
  spendUsd: number;
  exceptions: number;
  exceptionRate: number;
  open: number;
  duplicates: number;
  suspicious: number;
  lastInvoice: string;
  entities: string[];
};

export function vendorSummaries(invoices: Invoice[]): VendorSummary[] {
  const groups = new Map<string, Invoice[]>();
  for (const i of invoices) groups.set(i.vendor, [...(groups.get(i.vendor) ?? []), i]);
  return [...groups.entries()]
    .map(([name, rows]) => {
      const exceptions = rows.filter((i) => i.exception || i.status === 'review_required').length;
      return {
        name,
        category: rows[0]!.vendorCategory ?? '—',
        count: rows.length,
        spendUsd: rows.reduce((sum, i) => sum + usdOf(i), 0),
        exceptions,
        exceptionRate: exceptions / rows.length,
        open: rows.filter(isOpen).length,
        duplicates: rows.filter((i) => i.exception === 'duplicate').length,
        suspicious: rows.filter((i) => i.exception === 'suspicious').length,
        lastInvoice:
          rows
            .map((i) => i.invoiceDate)
            .sort()
            .at(-1) ?? '—',
        entities: [...new Set(rows.map((i) => i.entity).filter(Boolean) as string[])],
      };
    })
    .sort((a, b) => b.spendUsd - a.spendUsd);
}

/** Review queue order: riskiest first, then oldest. */
export function queueOrder(invoices: Invoice[]) {
  const rank = { high: 0, medium: 1, low: 2 };
  return invoices
    .filter(isOpen)
    .sort((a, b) => rank[a.risk] - rank[b.risk] || a.createdAt.localeCompare(b.createdAt));
}
