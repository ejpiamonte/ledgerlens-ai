import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { getInvoiceExtra, getWorkspaceInvoice, getWorkspaceInvoices } from '@/lib/supabase/workspace';
import { PageHead, RiskBadge, StatusBadge } from '@/components/ui';
import { InvoicePreview } from '@/components/invoice-preview';
import { ChecksList, FieldsPanel } from '@/components/invoice-detail';
import { DecisionReset, ReviewActions } from '@/components/review-actions';
import { isDemoMode } from '@/lib/config';
import { scenarioOfId } from '@/lib/demo-data';
import { SCENARIOS } from '@/lib/scenarios';
import { queueOrder } from '@/lib/insights';
import { EXCEPTION_LABEL, REVIEW_GUIDANCE } from '@/lib/labels';
import { dateTime, money, shortDate } from '@/lib/format';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const i = await getWorkspaceInvoice((await params).id);
  return { title: i ? `Review ${i.vendor}` : 'Review' };
}

export default async function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const i = await getWorkspaceInvoice(id);
  if (!i) notFound();
  const [extra, all] = await Promise.all([getInvoiceExtra(i.documentId), getWorkspaceInvoices()]);
  const scenario = SCENARIOS[scenarioOfId(i.id) ?? 'smb'];
  const auto = isDemoMode() ? scenario.autoConfidence : 0.9;
  const checks = extra?.validations ?? i.validations;
  const invoice = extra?.items?.length ? { ...i, lineItems: extra.items } : i;

  const queue = queueOrder(all);
  const pos = queue.findIndex((q) => q.id === i.id);
  const prev = pos > 0 ? queue[pos - 1] : undefined;
  const next = pos >= 0 ? queue[pos + 1] : queue[0];
  const original =
    i.exception === 'duplicate'
      ? all.find(
          (o) =>
            o.id !== i.id &&
            o.vendor === i.vendor &&
            o.invoiceNumber === i.invoiceNumber &&
            o.createdAt < i.createdAt,
        )
      : undefined;
  const notes = (extra?.normalized as { extraction_notes?: string } | null)?.extraction_notes;

  return (
    <>
      <PageHead
        crumbs={[{ label: 'Review queue', href: '/review' }, { label: `${i.vendor} ${i.invoiceNumber}` }]}
        title={`${i.vendor} · ${money(i.total, i.currency)}`}
        subtitle={`${i.invoiceNumber} · received ${dateTime(i.createdAt)} UTC via ${i.source}${i.entity && scenario.id === 'enterprise' ? ` · ${i.entity}` : ''}`}
        action={
          <div className="navpair" style={{ alignItems: 'center' }}>
            {pos >= 0 && (
              <span className="secondary" style={{ marginTop: 0 }}>
                {pos + 1} of {queue.length}
              </span>
            )}
            {prev ? (
              <Link className="btn small" href={`/review/${prev.id}`} aria-label="Previous in queue">
                <ArrowLeft size={13} aria-hidden /> Prev
              </Link>
            ) : null}
            {next && next.id !== i.id ? (
              <Link className="btn small" href={`/review/${next.id}`} aria-label="Next in queue">
                Next <ArrowRight size={13} aria-hidden />
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid two">
        <div className="stack">
          {extra?.previewUrl && (
            <a
              className="btn"
              href={extra.previewUrl}
              target="_blank"
              rel="noreferrer"
              style={{ justifySelf: 'start' }}
            >
              <ExternalLink size={14} aria-hidden /> Open original file
            </a>
          )}
          <InvoicePreview invoice={invoice} autoConfidence={auto} />
          <FieldsPanel invoice={i} autoConfidence={auto} />
        </div>

        <div className="stack">
          <section className={`callout ${i.risk === 'high' ? 'red' : ''}`}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <RiskBadge risk={i.risk} />
              <StatusBadge status={i.status} />
            </div>
            <b style={{ fontSize: 15 }}>
              {i.exception ? EXCEPTION_LABEL[i.exception] : 'Why it needs review'}
            </b>
            <div>{extra?.review?.reason ?? i.reason}</div>
            {original && (
              <div style={{ marginTop: 8 }}>
                Earlier copy:{' '}
                <Link className="link" href={`/documents/${original.id}`}>
                  {original.invoiceNumber}, received {shortDate(original.createdAt)}
                </Link>{' '}
                ({original.status === 'auto_processed' ? 'already posted for payment' : 'on file'})
              </div>
            )}
            {(notes || i.steps) && (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                {notes ?? i.audit?.find((a) => a.actor === 'AI extraction')?.description}
              </div>
            )}
          </section>

          {i.exception && (
            <section className="panel">
              <h2 className="panel-title">What to check</h2>
              <p style={{ margin: 0 }}>{REVIEW_GUIDANCE[i.exception]}</p>
            </section>
          )}

          <section className="panel">
            <h2 className="panel-title">Your decision</h2>
            {i.status === 'review_required' ? (
              <ReviewActions
                id={i.documentId}
                approver={i.approver}
                nextHref={next && next.id !== i.id ? `/review/${next.id}` : '/review'}
              />
            ) : (
              <div className="callout blue">
                <b>
                  {i.status === 'approved' ? 'Approved' : i.status === 'rejected' ? 'Rejected' : 'Decided'}
                  {i.decidedBy ? ` by ${i.decidedBy}` : ''}
                </b>
                {i.decisionNote ?? 'This invoice is no longer waiting for review.'}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {next && next.id !== i.id && (
                    <Link className="btn small primary" href={`/review/${next.id}`}>
                      Next in queue <ArrowRight size={13} aria-hidden />
                    </Link>
                  )}
                  {isDemoMode() && i.decidedBy?.startsWith('You') && <DecisionReset id={i.id} />}
                </div>
              </div>
            )}
            <p className="fineprint">
              AI extraction is advisory. Approving records your decision in the audit trail; it never happens
              automatically.
            </p>
          </section>

          <section className="panel">
            <h2 className="panel-title">Checks</h2>
            <ChecksList checks={checks} />
          </section>
        </div>
      </div>
    </>
  );
}
