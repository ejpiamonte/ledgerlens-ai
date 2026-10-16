'use client';

import { useState } from 'react';

type Assumptions = {
  monthlyVolume: number;
  manualMinutes: number;
  reviewMinutes: number;
  hourlyCost: number;
};

const PRODUCTIVE_HOURS_PER_FTE_MONTH = 140;

/**
 * Illustrative time and cost estimate. The touchless rate comes from the demo data;
 * everything else is an editable assumption so a visitor can plug in their own numbers.
 */
export function ImpactPanel({ touchlessRate, defaults }: { touchlessRate: number; defaults: Assumptions }) {
  const [a, setA] = useState(defaults);
  const set = (key: keyof Assumptions) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setA((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value) || 0) }));

  const manualHours = (a.monthlyVolume * a.manualMinutes) / 60;
  const remainingHours = (a.monthlyVolume * (1 - touchlessRate) * a.reviewMinutes) / 60;
  const hoursSaved = Math.max(0, manualHours - remainingHours);
  const annualCost = hoursSaved * a.hourlyCost * 12;
  const fte = hoursSaved / PRODUCTIVE_HOURS_PER_FTE_MONTH;
  const usd = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
      n,
    );

  const fields: [keyof Assumptions, string, number][] = [
    ['monthlyVolume', 'Invoices per month', 10],
    ['manualMinutes', 'Manual minutes per invoice', 1],
    ['reviewMinutes', 'Minutes per exception review', 1],
    ['hourlyCost', 'Loaded hourly cost (USD)', 1],
  ];

  return (
    <section className="panel" aria-labelledby="impact-title">
      <div className="panel-head">
        <div>
          <h2 className="panel-title" id="impact-title">
            Estimated impact
          </h2>
          <div className="secondary">
            Uses this workspace&apos;s {Math.round(touchlessRate * 100)}% touchless rate. Edit the assumptions
            to match your team.
          </div>
        </div>
      </div>
      <div className="impact-grid">
        <div>
          <div className="impact-num">{Math.round(hoursSaved).toLocaleString('en-US')} h</div>
          <div className="secondary">returned to the team each month</div>
        </div>
        <div>
          <div className="impact-num">{usd(annualCost)}</div>
          <div className="secondary">labor cost avoided per year</div>
        </div>
        <div>
          <div className="impact-num">{fte.toFixed(fte < 1 ? 2 : 1)}</div>
          <div className="secondary">FTE of capacity freed</div>
        </div>
      </div>
      <div className="assumptions">
        {fields.map(([key, label, stepValue]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              min={0}
              step={stepValue}
              value={a[key]}
              onChange={set(key)}
              inputMode="numeric"
            />
          </label>
        ))}
      </div>
      <p className="fineprint">
        Illustrative estimate based on the assumptions shown, not a measured result. Hours saved = manual
        entry time for all invoices minus review time for the share that still needs a person. FTE assumes{' '}
        {PRODUCTIVE_HOURS_PER_FTE_MONTH} productive hours per month.
      </p>
    </section>
  );
}
