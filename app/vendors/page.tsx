import Link from 'next/link';
import type { Metadata } from 'next';
import { getWorkspaceInvoices } from '@/lib/supabase/workspace';
import { getScenario } from '@/lib/demo-state';
import { isDemoMode } from '@/lib/config';
import { Badge, Empty, PageHead, Stat } from '@/components/ui';
import { vendorSummaries } from '@/lib/insights';
import { money, percent } from '@/lib/format';

export const metadata: Metadata = { title: 'Vendors' };

export default async function Vendors() {
  const [invoices, scenario] = await Promise.all([getWorkspaceInvoices(), getScenario()]);
  const vendors = vendorSummaries(invoices);
  const multiEntity = isDemoMode() && scenario.id === 'enterprise';
  const totalSpend = vendors.reduce((s, v) => s + v.spendUsd, 0);
  const top5Share = vendors.slice(0, 5).reduce((s, v) => s + v.spendUsd, 0) / (totalSpend || 1);
  const watch = vendors.filter(
    (v) => v.suspicious > 0 || v.duplicates > 0 || (v.count >= 3 && v.exceptionRate >= 0.4),
  );
  const maxSpend = vendors[0]?.spendUsd ?? 1;

  return (
    <>
      <PageHead
        title="Vendors"
        subtitle="Where the money goes and which suppliers generate the most exceptions. Use it to fix problems at the source."
      />
      <div className="grid stats">
        <Stat label="Active vendors" value={vendors.length} foot="Invoiced in the last 30 days" />
        <Stat
          label="Spend"
          value={money(totalSpend, 'USD', { compact: true })}
          foot={multiEntity ? 'USD equivalent' : 'Last 30 days'}
        />
        <Stat label="Top 5 share of spend" value={percent(top5Share)} foot="Concentration of payables" />
        <Stat
          label="Vendors to watch"
          value={watch.length}
          foot="Duplicates, bank changes, or frequent exceptions"
        />
      </div>
      <section className="panel flush">
        {vendors.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  {multiEntity && <th>Entities</th>}
                  <th className="num">Invoices</th>
                  <th>Spend (USD)</th>
                  <th className="num">Exception rate</th>
                  <th className="num">Open</th>
                  <th>Flags</th>
                  <th>Last invoice</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.name}>
                    <td>
                      <Link className="primarytext" href={`/documents?q=${encodeURIComponent(v.name)}`}>
                        {v.name}
                      </Link>
                      <div className="secondary">{v.category}</div>
                    </td>
                    {multiEntity && (
                      <td>{v.entities.map((e) => e.replace('Meridian Holdings ', '')).join(', ')}</td>
                    )}
                    <td className="num">{v.count}</td>
                    <td style={{ minWidth: 170 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="hbar-track" style={{ flex: 1 }}>
                          <div className="hbar-fill" style={{ width: `${(v.spendUsd / maxSpend) * 100}%` }} />
                        </div>
                        <span
                          style={{ fontVariantNumeric: 'tabular-nums', minWidth: 58, textAlign: 'right' }}
                        >
                          {money(v.spendUsd, 'USD', { compact: true })}
                        </span>
                      </div>
                    </td>
                    <td className="num">{percent(v.exceptionRate)}</td>
                    <td className="num">
                      {v.open ? (
                        <Link className="link" href="/review">
                          {v.open}
                        </Link>
                      ) : (
                        0
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {v.suspicious > 0 && <Badge tone="red">Bank change</Badge>}
                        {v.duplicates > 0 && <Badge tone="amber">Duplicate</Badge>}
                        {!v.suspicious && !v.duplicates && <span className="secondary">—</span>}
                      </div>
                    </td>
                    <td>{v.lastInvoice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No vendor data yet" />
        )}
      </section>
      <p className="secondary" style={{ marginTop: 12 }}>
        Click a vendor to see its invoices. Exception rate counts every invoice a rule held for a person.
      </p>
    </>
  );
}
