export function money(amount: number, currency = 'USD', options: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: options.compact ? 'compact' : 'standard',
    maximumFractionDigits: options.compact ? 1 : 2,
  }).format(amount);
}

export const percent = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`;

export const shortDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export const dateTime = (value: string | Date) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });

/** Human duration from milliseconds: "42 s", "3.5 h", "2.1 d". */
export function duration(ms: number): string {
  const s = ms / 1000;
  if (s < 90) return `${Math.round(s)} s`;
  const m = s / 60;
  if (m < 90) return `${Math.round(m)} min`;
  const h = m / 60;
  if (h < 36) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

export const integer = (value: number) => new Intl.NumberFormat('en-US').format(Math.round(value));
