/**
 * Demo scenarios. Each one describes a fictional company and the review policy it would run.
 * The same rules engine (lib/validation.ts) evaluates both; only the thresholds and data differ.
 */

export type ScenarioId = 'smb' | 'enterprise';

export type Entity = {
  name: string;
  short: string;
  currency: 'USD' | 'GBP' | 'EUR';
  taxRate: number;
};

export type ApprovalTier = { upTo: number | null; approver: string };

export type Scenario = {
  id: ScenarioId;
  label: string;
  company: string;
  initials: string;
  tagline: string;
  entities: Entity[];
  monthlyVolume: number;
  sampleSize: number;
  vendorCount: number;
  autoConfidence: number;
  reviewConfidence: number;
  highValueThresholdUsd: number;
  arithmeticTolerance: number;
  poPolicy: 'recurring-exempt' | 'required';
  approvalTiers: ApprovalTier[];
  reviewSlaHours: number;
  reviewers: string[];
  impact: { manualMinutes: number; reviewMinutes: number; hourlyCost: number };
};

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  smb: {
    id: 'smb',
    label: 'Small business',
    company: 'Harbor & Pine Hospitality',
    initials: 'HP',
    tagline: 'Two-location restaurant group · owner-approved payables',
    entities: [
      { name: 'Harbor & Pine — Downtown', short: 'Downtown', currency: 'USD', taxRate: 0.0825 },
      { name: 'Harbor & Pine — Waterfront', short: 'Waterfront', currency: 'USD', taxRate: 0.0825 },
    ],
    monthlyVolume: 120,
    sampleSize: 110,
    vendorCount: 12,
    autoConfidence: 0.9,
    reviewConfidence: 0.7,
    highValueThresholdUsd: 5000,
    arithmeticTolerance: 0.02,
    poPolicy: 'recurring-exempt',
    approvalTiers: [{ upTo: null, approver: 'Owner' }],
    reviewSlaHours: 48,
    reviewers: ['Dana Reyes (Owner)', 'Luis Ortega (Bookkeeper)'],
    impact: { manualMinutes: 8, reviewMinutes: 4, hourlyCost: 30 },
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    company: 'Meridian Holdings',
    initials: 'MH',
    tagline: 'Three legal entities · USD, GBP, EUR · tiered approvals',
    entities: [
      { name: 'Meridian Holdings US Inc.', short: 'US', currency: 'USD', taxRate: 0.07 },
      { name: 'Meridian Holdings UK Ltd', short: 'UK', currency: 'GBP', taxRate: 0.2 },
      { name: 'Meridian Holdings GmbH', short: 'DE', currency: 'EUR', taxRate: 0.19 },
    ],
    monthlyVolume: 2400,
    sampleSize: 240,
    vendorCount: 36,
    autoConfidence: 0.92,
    reviewConfidence: 0.75,
    highValueThresholdUsd: 50000,
    arithmeticTolerance: 0.02,
    poPolicy: 'required',
    approvalTiers: [
      { upTo: 10000, approver: 'AP specialist' },
      { upTo: 50000, approver: 'AP manager' },
      { upTo: null, approver: 'Financial controller' },
    ],
    reviewSlaHours: 24,
    reviewers: ['Priya Shah (AP specialist)', 'Tom Becker (AP manager)', 'Elena Rossi (Controller)'],
    impact: { manualMinutes: 6, reviewMinutes: 5, hourlyCost: 45 },
  },
};

export const SCENARIO_IDS: ScenarioId[] = ['smb', 'enterprise'];
export const SCENARIO_COOKIE = 'll_scenario';

/** Fixed demo FX rates so enterprise spend can be summarised in one currency. */
export const USD_RATE: Record<string, number> = { USD: 1, GBP: 1.27, EUR: 1.08 };

export const toUsd = (amount: number, currency: string) => amount * (USD_RATE[currency] ?? 1);

export const parseScenarioId = (value: string | undefined | null): ScenarioId =>
  value === 'enterprise' ? 'enterprise' : 'smb';

export function approverFor(scenario: Scenario, totalUsd: number): string {
  const tier = scenario.approvalTiers.find((t) => t.upTo === null || totalUsd <= t.upTo);
  return tier?.approver ?? scenario.approvalTiers.at(-1)!.approver;
}
