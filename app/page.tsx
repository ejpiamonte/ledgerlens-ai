import Link from 'next/link';
import { ArrowRight, Clock3, FileText, ShieldAlert, Wallet, Zap } from 'lucide-react';
import { Badge, Empty, PageHead, Stat, UploadLink } from '@/components/ui';
import { InvoiceTable } from '@/components/invoice-table';
import { VolumeChart } from '@/components/volume-chart';
import { ImpactPanel } from '@/components/impact-panel';
import { getWorkspaceInvoices } from '@/lib/supabase/workspace';
import { getScenario } from '@/lib/demo-state';
import { isDemoMode } from '@/lib/config';
import { summarize, vendorSummaries } from '@/lib/insights';
import { EXCEPTION_LABEL } from '@/lib/labels';
import { duration, integer, money, percent } from '@/lib/format';
import { approverFor } from '@/lib/scenarios';

export default async function Overview() {
  const [invoices, scenario] = await Promise.all([getWorkspaceInvoices(), getScenario()]);
  const demo = isDemoMode();
  const s = summarize(invoices);
  const vendors = vendorSummaries(invoices).slice(0, 5);
  const topException = s.exceptions[0]?.count ?? 1;
  const multiEntity = demo && scenario.entities.length > 1 && scenario.id === 'enterprise';
  const highValue = invoices.find((i) => i.showcase === 'high-value');

  return (
    <>
      <PageHead
        title="Accounts payable overview"
        subtitle={
          demo
            ? `Last 30 days at ${scenario.company}. Every invoice is read by AI, checked by deterministic rules, and only the exceptions reach a person.`
            : 'Live invoice intake, verification, and review from Supabase.'
        }
        action={<UploadLink />}
      />

      {demo && (
        <section className="tour" aria-labelledby="tour-title">
          <div>
            <h2 id="tour-title">Start here: a 2-minute tour</h2>
            <p>
              Three invoices show the whole workflow. Switch between <b>Small business</b> and{' '}
              <b>Enterprise</b> in the top bar to see how the same rules scale.
            </p>
          </div>
          <div className="tour-steps">
            <Link className="tour-step" href={`/documents/${scenario.id}-clean`}>
              <i>STEP 1</i>
              <b>A clean invoice goes straight through</b>
              <span>AI reads it, every check passes, no one touches it.</span>
            </Link>
            <Link className="tour-step" href={`/review/${scenario.id}-duplicate`}>
              <i>STEP 2</i>
              <b>Catch a duplicate before it is paid</b>
              <span>See why it was held, then approve or reject it yourself.</span>
            </Link>
            <Link className="tour-step" href={`/review/${scenario.id}-high-value`}>
              <i>STEP 3</i>
              <b>Route a large bill to the right approver</b>
              <span>
                Over {money(scenario.highValueThresholdUsd, 'USD', { compact: true })} goes to the{' '}
                {highValue ? approverFor(scenario, highValue.totalUsd ?? highValue.total) : 'approver'}.
              </span>
            </Link>
          </div>
        </section>
      )}

      <div className="grid stats">
        <Stat
          icon={<FileText size={15} aria-hidden />}
          label="Invoices processed"
          value={integer(s.total)}
          foot={
            demo && scenario.sampleSize < scenario.monthlyVolume
              ? `Representative sample of ~${integer(scenario.monthlyVolume)} per month`
              : 'Last 30 days, all intake channels'
          }
        />
        <Stat
          icon={<Zap size={15} aria-hidden />}
          label="Touchless rate"
          value={percent(s.touchlessRate)}
          foot={`${s.touchless} posted with no manual work · median ${duration(s.touchlessMs)}`}
        />
        <Stat
          icon={<Clock3 size={15} aria-hidden />}
          label="Waiting for review"
          value={s.open}
          foot={
            s.open
              ? `${money(s.openValueUsd, 'USD', { compact: true })} on hold · oldest ${duration(s.oldestOpenMs)}`
              : 'Queue is clear'
          }
        />
        <Stat
          icon={<Wallet size={15} aria-hidden />}
          label="Spend processed"
          value={money(s.spendUsd, 'USD', { compact: true })}
          foot={
            multiEntity
              ? `USD equivalent across ${scenario.entities.length} entities`
              : `${percent(s.touchlessSpendUsd / (s.spendUsd || 1))} of it touchless`
          }
        />
      </div>

      <div className="grid charts">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Daily invoice volume</h2>
              <div className="secondary">Last 30 days · hover a day for detail</div>
            </div>
          </div>
          {invoices.length ? (
            <VolumeChart data={s.daily} />
          ) : (
            <Empty title="No invoices yet" body="Upload a document to start." />
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Why invoices needed a person</h2>
              <div className="secondary">
                {s.reviewed} of {s.total} invoices ({percent(s.reviewed / (s.total || 1))}) were held by a
                rule
              </div>
            </div>
          </div>
          {s.exceptions.length ? (
            <div className="hbars">
              {s.exceptions.map((e) => (
                <div className="hbar-row" key={e.kind}>
                  <div className="hbar-label">
                    <span>{EXCEPTION_LABEL[e.kind]}</span>
                  </div>
                  <div className="hbar-track">
                    <div className="hbar-fill" style={{ width: `${(e.count / topException) * 100}%` }} />
                  </div>
                  <div className="hbar-value">{e.count}</div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No exceptions"
              body={demo ? undefined : 'Exception reasons appear once invoices are processed.'}
            />
          )}
        </section>
      </div>

      <div className="grid three" style={{ marginBottom: 16 }}>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Review queue health</h2>
              <div className="secondary">Target: decided within {scenario.reviewSlaHours} hours</div>
            </div>
            <Link href="/review" className="btn small">
              Open queue <ArrowRight size={13} aria-hidden />
            </Link>
          </div>
          {s.aging.map((a) => (
            <div className="check" key={a.label}>
              <span>{a.label}</span>
              <Badge tone={a.count ? a.tone : ''}>{a.count}</Badge>
            </div>
          ))}
          <div className="check">
            <span>Median time to a human decision</span>
            <b>{s.reviewedMs ? duration(s.reviewedMs) : '—'}</b>
          </div>
          {s.preventedCount > 0 && (
            <div className="callout green" style={{ marginTop: 12 }}>
              <b>
                <ShieldAlert size={13} aria-hidden style={{ verticalAlign: -2 }} />{' '}
                {money(s.preventedUsd, 'USD', { compact: true })} stopped before payment
              </b>
              {s.preventedCount} duplicate, suspicious, or mis-totalled invoices were rejected by reviewers.
            </div>
          )}
        </section>

        <ImpactPanel
          key={scenario.id}
          touchlessRate={s.touchlessRate}
          defaults={{
            monthlyVolume: scenario.monthlyVolume,
            manualMinutes: scenario.impact.manualMinutes,
            reviewMinutes: scenario.impact.reviewMinutes,
            hourlyCost: scenario.impact.hourlyCost,
          }}
        />

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Top vendors by spend</h2>
              <div className="secondary">With each vendor&apos;s exception rate</div>
            </div>
            <Link href="/vendors" className="btn small">
              All vendors <ArrowRight size={13} aria-hidden />
            </Link>
          </div>
          {vendors.map((v) => (
            <div className="check" key={v.name}>
              <span style={{ minWidth: 0 }}>
                <span className="primarytext">{v.name}</span>
                <div className="secondary">
                  {v.count} invoices · {v.category}
                </div>
              </span>
              <span style={{ textAlign: 'right' }}>
                <b style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {money(v.spendUsd, 'USD', { compact: true })}
                </b>
                <div className="secondary">{percent(v.exceptionRate)} exceptions</div>
              </span>
            </div>
          ))}
        </section>
      </div>

      <section className="panel flush">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Latest invoices</h2>
            <div className="secondary">Extraction, checks, and decision for each document</div>
          </div>
          <Link href="/documents" className="btn small">
            All documents <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
        {invoices.length ? (
          <InvoiceTable rows={invoices.slice(0, 6)} showEntity={multiEntity} />
        ) : (
          <Empty title="No invoices yet" body="Upload a document to start processing." />
        )}
      </section>
    </>
  );
}
