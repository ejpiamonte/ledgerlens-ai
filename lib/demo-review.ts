import { NextResponse } from 'next/server';
import { getWorkspaceInvoice } from '@/lib/supabase/workspace';
import { saveDemoDecision } from '@/lib/demo-state';
import { STATUS_LABEL } from '@/lib/labels';

/** Demo Mode review action: validates the invoice is open, then records the decision for this visitor only. */
export async function recordDemoDecision(id: string, decision: 'approved' | 'rejected', note?: string) {
  const invoice = await getWorkspaceInvoice(id);
  if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  if (invoice.status !== 'review_required')
    return NextResponse.json(
      { error: `This invoice is already "${STATUS_LABEL[invoice.status]}". Use Reprocess to reset it.` },
      { status: 409 },
    );
  await saveDemoDecision(id, {
    d: decision,
    n: note?.trim().slice(0, 120) || undefined,
    t: new Date().toISOString(),
  });
  return NextResponse.json({
    ok: true,
    demo: true,
    message:
      decision === 'approved'
        ? 'Approved. The decision is recorded in the audit trail (stored in your browser for this demo).'
        : 'Rejected. The reason is recorded in the audit trail (stored in your browser for this demo).',
  });
}
