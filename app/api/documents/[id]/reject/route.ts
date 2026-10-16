import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminClient } from '@/lib/supabase/server';
import { isDemoMode } from '@/lib/config';
import { recordDemoDecision } from '@/lib/demo-review';
const input = z.object({ reason: z.string().trim().min(3).max(1000) });
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body;
  try {
    body = input.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: 'A rejection reason of at least 3 characters is required.' },
      { status: 400 },
    );
  }
  if (isDemoMode()) return recordDemoDecision(id, 'rejected', body.reason);
  try {
    const db = getAdminClient(),
      { data: invoice, error: loadError } = await db
        .from('ledgerlens_invoices')
        .select('id,approval_status')
        .eq('document_id', id)
        .single();
    if (loadError || !invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    if (invoice.approval_status !== 'pending')
      return NextResponse.json({ error: `Invoice is already ${invoice.approval_status}.` }, { status: 409 });
    const at = new Date().toISOString();
    const { error: updateError } = await db
      .from('ledgerlens_invoices')
      .update({ approval_status: 'rejected', updated_at: at })
      .eq('id', invoice.id)
      .eq('approval_status', 'pending');
    if (updateError) throw updateError;
    const updates = await Promise.all([
      db
        .from('ledgerlens_documents')
        .update({ status: 'rejected', review_status: 'rejected', updated_at: at })
        .eq('id', id),
      db
        .from('ledgerlens_review_queue')
        .update({
          status: 'rejected',
          reviewed_by: 'workspace operator',
          reviewed_at: at,
          notes: body.reason,
        })
        .eq('document_id', id)
        .eq('status', 'pending'),
      db.from('ledgerlens_audit_logs').insert({
        document_id: id,
        invoice_id: invoice.id,
        action: 'invoice_rejected',
        actor_type: 'human',
        actor_name: 'Workspace operator',
        description: body.reason,
      }),
      db.from('ledgerlens_notifications').insert({
        document_id: id,
        invoice_id: invoice.id,
        notification_type: 'rejected',
        subject: 'Invoice rejected',
        body: body.reason,
        status: 'logged',
        provider: 'demo-log',
        is_mock: true,
      }),
    ]);
    if (updates.some((result) => result.error))
      throw new Error('Review decision could not be completely recorded.');
    return NextResponse.json({ ok: true, message: 'Invoice rejected and audit event recorded.' });
  } catch {
    return NextResponse.json(
      { error: 'Rejection requires a configured Supabase database and a persisted pending invoice.' },
      { status: 503 },
    );
  }
}
