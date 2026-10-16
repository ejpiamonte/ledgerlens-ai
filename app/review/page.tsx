import Link from 'next/link';
import type { Metadata } from 'next';
import { getWorkspaceInvoices } from '@/lib/supabase/workspace';
import { getScenario } from '@/lib/demo-state';
import { Badge, Empty, PageHead, RiskBadge, StatusBadge } from '@/components/ui';
import { queueOrder, usdOf } from '@/lib/insights';
import { EXCEPTION_LABEL } from '@/lib/labels';
import { dateTime, duration, money } from '@/lib/format';
import type { ExceptionKind } from '@/lib/types';

export const metadata: Metadata = { title: 'Review queue' };

export default async function Review() {
  const [invoices, scenario] = await Promise.all([getWorkspaceInvoices(), getScenario()]);
  const rows = queueOrder(invoices);
  const now = Date.now();
  const slaMs = scenario.reviewSlaHours * 3_600_000;
  const recent = invoices
    .filter((i) => i.decidedAt)
    .sort((a, b) => b.decidedAt!.localeCompare(a.decidedAt!))
    .slice(0, 6);
  const kinds = new Map<ExceptionKind, number>();
  for (const i of rows) if (i.exception) kinds.set(i.exception, (kinds.get(i.exception) ?? 0) + 1);
  const valueOnHold = rows.reduce((s, i) => s + usdOf(i), 0);

  return (
    <>
      <PageHead
        title="Review queue"
        subtitle={`Only invoices a rule could not clear land here, riskiest first. Target: a decision within ${scenario.reviewSlaHours} hours.`}
      />

      <div className="chips">
        <Badge tone={rows.length ? 'amber' : 'green'}>{rows.length} waiting</Badge>
        <span>{money(valueOnHold, 'USD', { compact: true })} on hold</span>
        {[...kinds.entries()].map(([k, n]) => (
          <span className="chip" key={k} style={{ background: '#f1f4f8', color: 'var(--ink-2)' }}>
            {EXCEPTION_LABEL[k]} · {n}
          </span>
        ))}
      </div>

      <section className="panel flush">
        {rows.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Vendor / invoice</th>
                  <th className="num">Amount</th>
                  <th>Why it was held</th>
                  <th>Approver</th>
                  <th>Review target</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => {
                  const left = slaMs - (now - Date.parse(i.createdAt));
                  return (
                    <tr key={i.id}>
                      <td>
                        <RiskBadge risk={i.risk} />
                      </td>
                      <td>
                        <Link className="primarytext" href={`/review/${i.id}`}>
                          {i.vendor}
                        </Link>
                        <div className="secondary">
                          {i.invoiceNumber}
                          {i.entity && scenario.id === 'enterprise'
                            ? ` · ${i.entity.replace('Meridian Holdings ', '')}`
                            : ''}
                        </div>
                      </td>
                      <td className="num primarytext">{money(i.total, i.currency)}</td>
                      <td className="wrap">
                        <b style={{ fontWeight: 650 }}>
                          {i.exception ? EXCEPTION_LABEL[i.exception] : 'Needs review'}
                        </b>
                        <div className="secondary">{i.reason}</div>
                      </td>
                      <td>{i.approver ?? '—'}</td>
                      <td>
                        <Badge tone={left < 0 ? 'red' : left < slaMs / 4 ? 'amber' : 'green'}>
                          {left < 0 ? `Overdue ${duration(-left)}` : `Due in ${duration(left)}`}
                        </Badge>
                      </td>
                      <td>
                        <Link className="btn small primary" href={`/review/${i.id}`}>
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Queue is clear"
            body="Nothing is waiting for a human decision. Reset the demo in Rules & settings to start again."
          />
        )}
      </section>

      {recent.length > 0 && (
        <section className="panel flush" style={{ marginTop: 16 }}>
          <div className="panel-head" style={{ paddingBottom: 12 }}>
            <div>
              <h2 className="panel-title">Recently decided</h2>
              <div className="secondary">Every human decision is kept in the audit trail with its note</div>
            </div>
          </div>
          <div className="tablewrap">
            <table>
              <tbody>
                {recent.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link className="primarytext" href={`/documents/${i.id}`}>
                        {i.vendor}
                      </Link>
                      <div className="secondary">
                        {i.exception ? EXCEPTION_LABEL[i.exception] : i.invoiceNumber}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={i.status} />
                    </td>
                    <td className="wrap secondary">{i.decisionNote}</td>
                    <td>
                      {i.decidedBy}
                      <div className="secondary">{dateTime(i.decidedAt!)} UTC</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
