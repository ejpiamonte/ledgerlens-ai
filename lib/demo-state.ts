import { cookies } from 'next/headers';
import { parseScenarioId, SCENARIO_COOKIE, SCENARIOS, type Scenario } from './scenarios';
import type { Invoice } from './types';

/**
 * Per-visitor demo state kept in cookies, so review decisions work without a database
 * and never leak between visitors.
 */

export const DECISIONS_COOKIE = 'll_demo_decisions';
const MAX_DECISIONS = 12; // keeps the cookie well under the 4 KB browser limit

export type DemoDecision = { d: 'approved' | 'rejected'; n?: string; t: string };
export type DemoDecisions = Record<string, DemoDecision>;

export async function getScenario(): Promise<Scenario> {
  const store = await cookies();
  return SCENARIOS[parseScenarioId(store.get(SCENARIO_COOKIE)?.value)];
}

export async function getDemoDecisions(): Promise<DemoDecisions> {
  const store = await cookies();
  const raw = store.get(DECISIONS_COOKIE)?.value;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as DemoDecisions;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveDemoDecision(id: string, decision: DemoDecision | null) {
  const store = await cookies();
  const current = await getDemoDecisions();
  if (decision) current[id] = decision;
  else delete current[id];
  const entries = Object.entries(current)
    .sort(([, a], [, b]) => b.t.localeCompare(a.t))
    .slice(0, MAX_DECISIONS);
  store.set(DECISIONS_COOKIE, JSON.stringify(Object.fromEntries(entries)), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearDemoDecisions() {
  const store = await cookies();
  store.delete(DECISIONS_COOKIE);
}

export function applyDecisions(invoices: Invoice[], decisions: DemoDecisions): Invoice[] {
  if (!Object.keys(decisions).length) return invoices;
  return invoices.map((invoice) => {
    const decision = decisions[invoice.id];
    if (!decision || invoice.status !== 'review_required') return invoice;
    const action = decision.d === 'approved' ? 'Approved' : 'Rejected';
    return {
      ...invoice,
      status: decision.d,
      decidedAt: decision.t,
      decidedBy: 'You (demo reviewer)',
      decisionNote: decision.n || null,
      audit: [
        ...(invoice.audit ?? []),
        {
          at: decision.t,
          actor: 'You (demo reviewer)',
          action,
          description: decision.n || `${action} in the demo workspace.`,
        },
      ],
    };
  });
}
