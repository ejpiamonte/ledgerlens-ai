import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Badge, PageHead } from '@/components/ui';
import { ResetDemo } from '@/components/reset-demo';
import { getScenario } from '@/lib/demo-state';
import { isDemoMode } from '@/lib/config';
import { money, percent } from '@/lib/format';

export const metadata: Metadata = { title: 'Rules & settings' };
export const dynamic = 'force-dynamic';

function Row({ label, value, help }: { label: string; value: ReactNode; help: string }) {
  return (
    <div className="check">
      <div>
        <strong>{label}</strong>
        <div className="secondary">{help}</div>
      </div>
      <span style={{ fontWeight: 650, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const configured = (on: boolean, yes = 'Configured', no = 'Not configured') => (
  <Badge tone={on ? 'green' : ''}>{on ? yes : no}</Badge>
);

export default async function Settings() {
  const demo = isDemoMode();
  const s = await getScenario();
  const tiers = s.approvalTiers.map((t, k) => {
    const from = k === 0 ? 0 : s.approvalTiers[k - 1]!.upTo!;
    return `${t.upTo === null ? `Over ${money(from, 'USD', { compact: true })}` : `Up to ${money(t.upTo, 'USD', { compact: true })}`}: ${t.approver}`;
  });

  return (
    <>
      <PageHead
        title="Rules & settings"
        subtitle={
          demo
            ? `The review policy ${s.company} runs. Switch company size in the top bar to compare policies.`
            : 'Environment-backed service status and deterministic review policy.'
        }
      />
      <div className="grid two">
        <section className="panel">
          <h2 className="panel-title">Approval policy · {demo ? s.label : 'Live defaults'}</h2>
          <Row
            label="Auto-approve when confidence is"
            value={`≥ ${percent(s.autoConfidence)}`}
            help="And every deterministic check passes"
          />
          <Row
            label="Human review band"
            value={`${percent(s.reviewConfidence)}–${percent(s.autoConfidence - 0.01)}`}
            help="Uncertain reads are never silently approved"
          />
          <Row
            label="Low confidence"
            value={`< ${percent(s.reviewConfidence)}`}
            help="High-priority manual review"
          />
          <Row
            label="Approval threshold"
            value={money(s.highValueThresholdUsd, 'USD')}
            help="Larger invoices always need a person"
          />
          <Row
            label="Approval levels"
            value={
              <span style={{ display: 'grid', gap: 2 }}>
                {tiers.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </span>
            }
            help="Who must sign off, by invoice amount (USD equivalent)"
          />
          <Row
            label="Purchase-order matching"
            value={s.poPolicy === 'required' ? 'Required for all vendors' : 'Recurring services exempt'}
            help={
              s.poPolicy === 'required'
                ? 'PO must exist in the entity registry'
                : 'Utilities and subscriptions skip PO matching'
            }
          />
          <Row
            label="Duplicate rule"
            value="Vendor + invoice # + amount"
            help="Normalized vendor name, ±$0.02"
          />
          <Row
            label="Arithmetic tolerance"
            value={money(s.arithmeticTolerance, 'USD')}
            help="Subtotal + tax must equal total"
          />
          <Row label="Bank-detail changes" value="Always reviewed" help="Flagged as a suspicious signal" />
          <Row
            label="Review target"
            value={`${s.reviewSlaHours} hours`}
            help="Shown as due / overdue in the queue"
          />
        </section>

        <div className="stack">
          <section className="panel">
            <h2 className="panel-title">Integrations</h2>
            <Row
              label="Supabase"
              value={configured(
                Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
              )}
              help="Database and private document storage (live mode)"
            />
            <Row
              label="OpenAI"
              value={configured(Boolean(process.env.OPENAI_API_KEY))}
              help="Live structured extraction"
            />
            <Row
              label="Resend"
              value={configured(Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM))}
              help="Optional reviewer email notifications"
            />
            <Row
              label="n8n"
              value={configured(Boolean(process.env.N8N_WEBHOOK_URL))}
              help="Optional workflow orchestration"
            />
            <Row
              label="Webhook authentication"
              value={configured(Boolean(process.env.WEBHOOK_SECRET), 'Enabled', 'Off')}
              help="Bearer secret for external ingestion"
            />
            <p className="fineprint">Secrets are never sent to the browser. Only their presence is shown.</p>
          </section>

          {demo && (
            <section className="panel">
              <h2 className="panel-title">Demo controls</h2>
              <p className="secondary" style={{ marginTop: 0 }}>
                Your approvals and rejections are stored only in your browser. Reset them to replay the review
                queue.
              </p>
              <ResetDemo />
            </section>
          )}
        </div>
      </div>
    </>
  );
}
