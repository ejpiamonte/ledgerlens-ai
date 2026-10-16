import { Badge } from './ui';
import { checkLabel, confidenceTone } from '@/lib/labels';
import { dateTime, duration, money, percent } from '@/lib/format';
import type { AuditEvent, Invoice, RunStep } from '@/lib/types';

type AnyCheck = { name?: string; validation_type?: string; status: string; message: string };
type AnyStep = {
  key: string;
  label: string;
  status: string;
  detail: string;
  durationMs?: number;
  duration_ms?: number;
};
type LiveAudit = { action: string; actor_name: string; description: string; created_at: string };

export function FieldsPanel({
  invoice: i,
  autoConfidence = 0.9,
}: {
  invoice: Invoice;
  autoConfidence?: number;
}) {
  const conf = (field: keyof NonNullable<Invoice['fieldConfidence']>) => i.fieldConfidence?.[field];
  const rows: [string, string, number | undefined][] = [
    ['Vendor', i.vendor, conf('vendor')],
    ['Invoice number', i.invoiceNumber, conf('invoiceNumber')],
    ['Invoice date', i.invoiceDate, conf('invoiceDate')],
    ['Due date', i.dueDate ?? 'Not found', conf('dueDate')],
    ['Purchase order', i.poNumber ?? 'Not found', conf('poNumber')],
    ['Total', money(i.total, i.currency), conf('total')],
    ...(i.entity ? ([['Entity', i.entity, undefined]] as [string, string, undefined][]) : []),
    ['Source', i.source, undefined],
  ];
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Extracted fields</h2>
        <Badge tone={confidenceTone(i.confidence, autoConfidence)}>
          {percent(i.confidence)} overall confidence
        </Badge>
      </div>
      <div className="kv">
        {rows.map(([label, value, c]) => (
          <div className="kvitem" key={label}>
            <div className="kvlabel">{label}</div>
            <div className="kvvalue">
              {value}
              {c !== undefined && c < autoConfidence && <Badge tone="amber">{percent(c)}</Badge>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ChecksList({ checks }: { checks: AnyCheck[] }) {
  if (!checks.length) return <div className="secondary">No checks are recorded for this document.</div>;
  return (
    <div>
      {checks.map((v, k) => {
        const name = v.validation_type ?? v.name ?? 'check';
        const tone = v.status === 'passed' ? 'green' : v.status === 'failed' ? 'red' : 'amber';
        return (
          <div className="check" key={`${name}-${k}`}>
            <span>
              <span style={{ fontWeight: 650 }}>{checkLabel(name)}</span>
              <div className="secondary">{v.message}</div>
            </span>
            <Badge tone={tone}>
              {v.status === 'passed' ? 'Passed' : v.status === 'failed' ? 'Failed' : 'Flag'}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export function RunTimeline({ steps }: { steps: (RunStep | AnyStep)[] }) {
  const total = steps.reduce((s, x) => s + ((x as RunStep).durationMs ?? (x as AnyStep).duration_ms ?? 0), 0);
  return (
    <>
      <div className="timeline">
        {steps.map((s, k) => {
          const ms = (s as RunStep).durationMs ?? (s as AnyStep).duration_ms ?? 0;
          return (
            <div
              className={`event ${s.status === 'warning' ? 'warn' : s.status === 'failed' ? 'fail' : ''}`}
              key={`${s.key}-${k}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong>{s.label}</strong>
                <span className="secondary" style={{ fontVariantNumeric: 'tabular-nums', marginTop: 0 }}>
                  {ms < 1000 ? `${ms} ms` : duration(ms)}
                </span>
              </div>
              <div className="secondary">{s.detail}</div>
            </div>
          );
        })}
      </div>
      {total > 0 && <div className="secondary">Total processing time {duration(total)}</div>}
    </>
  );
}

export function AuditTrail({ events }: { events: (AuditEvent | LiveAudit)[] }) {
  if (!events.length) return <div className="secondary">No audit events recorded.</div>;
  const norm = events
    .map((e) =>
      'at' in e
        ? e
        : {
            at: e.created_at,
            actor: e.actor_name,
            action: e.action.replaceAll('_', ' '),
            description: e.description,
          },
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  return (
    <div className="timeline">
      {norm.map((e, k) => {
        const human = !/LedgerLens|AI extraction|Rules engine|worker|API/i.test(e.actor);
        return (
          <div className={`event ${human ? 'human' : ''}`} key={k}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <strong>{e.action}</strong>
              <span className="secondary" style={{ marginTop: 0 }}>
                {dateTime(e.at)} UTC
              </span>
            </div>
            <div className="secondary">
              {e.actor} · {e.description}
            </div>
          </div>
        );
      })}
    </div>
  );
}
