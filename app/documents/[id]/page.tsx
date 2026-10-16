import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { getInvoiceExtra, getWorkspaceInvoice } from '@/lib/supabase/workspace';
import { PageHead, RiskBadge, StatusBadge } from '@/components/ui';
import { InvoicePreview } from '@/components/invoice-preview';
import { AuditTrail, ChecksList, FieldsPanel, RunTimeline } from '@/components/invoice-detail';
import { DecisionReset } from '@/components/review-actions';
import { isDemoMode } from '@/lib/config';
import { scenarioOfId } from '@/lib/demo-data';
import { SCENARIOS } from '@/lib/scenarios';
import { EXCEPTION_LABEL } from '@/lib/labels';
import { dateTime } from '@/lib/format';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const i = await getWorkspaceInvoice((await params).id);
  return { title: i ? `${i.vendor} ${i.invoiceNumber}` : 'Document' };
}

export default async function DocumentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const i = await getWorkspaceInvoice(id);
  if (!i) notFound();
  const extra = await getInvoiceExtra(i.documentId);
  const scenario = SCENARIOS[scenarioOfId(i.id) ?? 'smb'];
  const auto = isDemoMode() ? scenario.autoConfidence : 0.9;
  const invoice = extra?.items?.length ? { ...i, lineItems: extra.items } : i;
  const checks = extra?.validations ?? i.validations;
  const steps = extra?.runs?.[0]?.steps ?? i.steps ?? [];
  const audit = extra?.audit ?? i.audit ?? [];
  const notes = (extra?.normalized as { extraction_notes?: string } | null)?.extraction_notes;

  return (
    <>
      <PageHead
        crumbs={[{ label: 'Documents', href: '/documents' }, { label: i.invoiceNumber }]}
        title={`${i.vendor} · ${i.invoiceNumber}`}
        subtitle={`${i.filename} · received ${dateTime(i.createdAt)} UTC via ${i.source}`}
        action={
          <>
            {extra?.previewUrl && (
              <a className="btn" href={extra.previewUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} aria-hidden /> Original file
              </a>
            )}
            {i.status === 'review_required' && (
              <Link className="btn primary" href={`/review/${i.id}`}>
                Review this invoice <ArrowRight size={14} aria-hidden />
              </Link>
            )}
          </>
        }
      />

      <div className="grid two">
        <div className="stack">
          <InvoicePreview invoice={invoice} autoConfidence={auto} />
          <section className="panel">
            <h2 className="panel-title">Processing timeline</h2>
            {steps.length ? (
              <RunTimeline steps={steps} />
            ) : (
              <div className="secondary">No run recorded yet.</div>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Decision</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                <StatusBadge status={i.status} />
                <RiskBadge risk={i.risk} />
              </div>
            </div>
            <p style={{ margin: 0 }}>
              {i.exception ? <b>{EXCEPTION_LABEL[i.exception]}. </b> : null}
              {extra?.review?.reason ?? i.reason}
            </p>
            {i.decidedBy && (
              <div className="callout blue" style={{ marginTop: 12 }}>
                <b>
                  {i.status === 'approved' ? 'Approved' : 'Rejected'} by {i.decidedBy}
                </b>
                {i.decisionNote ?? 'No note recorded.'} · {dateTime(i.decidedAt!)} UTC
                {isDemoMode() && i.decidedBy.startsWith('You') && (
                  <div style={{ marginTop: 8 }}>
                    <DecisionReset id={i.id} />
                  </div>
                )}
              </div>
            )}
            {(notes ?? i.steps) && (
              <div className="secondary" style={{ marginTop: 10 }}>
                AI extraction is advisory. Deterministic rules and a person decide the outcome.
                {notes && ` Extraction note: ${notes}`}
              </div>
            )}
          </section>

          <FieldsPanel invoice={i} autoConfidence={auto} />

          <section className="panel">
            <h2 className="panel-title">Validation checks</h2>
            <ChecksList checks={checks} />
          </section>

          <section className="panel">
            <h2 className="panel-title">Audit trail</h2>
            <AuditTrail events={audit} />
          </section>
        </div>
      </div>
    </>
  );
}
