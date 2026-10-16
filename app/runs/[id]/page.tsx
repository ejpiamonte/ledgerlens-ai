import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getInvoiceExtra, getWorkspaceInvoice } from '@/lib/supabase/workspace';
import { PageHead, StatusBadge } from '@/components/ui';
import { AuditTrail, RunTimeline } from '@/components/invoice-detail';
import { isDemoMode } from '@/lib/config';
import { dateTime, duration } from '@/lib/format';

export const metadata = { title: 'Run detail' };

export default async function RunDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const i = await getWorkspaceInvoice(id);
  if (!i) notFound();
  const extra = await getInvoiceExtra(i.documentId);
  const run = extra?.runs?.[0];
  const steps = run?.steps ?? i.steps ?? [];

  return (
    <>
      <PageHead
        crumbs={[{ label: 'Automation runs', href: '/runs' }, { label: i.invoiceNumber }]}
        title={`Run for ${i.vendor} ${i.invoiceNumber}`}
        subtitle={`${isDemoMode() ? 'Demo' : 'Live'} run · triggered by ${i.source} · started ${dateTime(i.createdAt)} UTC${i.processingMs ? ` · ${duration(i.processingMs)} end to end` : ''}`}
        action={
          <Link className="btn" href={`/documents/${i.id}`}>
            Open document <ArrowRight size={14} aria-hidden />
          </Link>
        }
      />
      <div className="grid two">
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Pipeline steps</h2>
            <StatusBadge status={i.status} />
          </div>
          {steps.length ? (
            <RunTimeline steps={steps} />
          ) : (
            <div className="secondary">No step detail recorded.</div>
          )}
          {run?.error && (
            <div className="callout red" style={{ marginTop: 12 }}>
              <b>Run diagnostic</b>
              {run.error}
            </div>
          )}
        </section>
        <section className="panel">
          <h2 className="panel-title">Audit trail</h2>
          <AuditTrail events={extra?.audit ?? i.audit ?? []} />
        </section>
      </div>
    </>
  );
}
