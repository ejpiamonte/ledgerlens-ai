import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/server';
import { processQueuedDocument } from '@/lib/automation/worker';
import { isDemoMode } from '@/lib/config';
import { saveDemoDecision } from '@/lib/demo-state';
export const maxDuration = 120;
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDemoMode()) {
    // Demo Mode: re-running the deterministic rules gives the same result, so this resets the visitor's decision.
    await saveDemoDecision(id, null);
    return NextResponse.json({
      ok: true,
      demo: true,
      message:
        'Re-ran extraction and rules. The result is unchanged and the invoice is back in the review queue.',
    });
  }
  try {
    const db = getAdminClient();
    const { data: doc, error } = await db
      .from('ledgerlens_documents')
      .select('id,processing_status')
      .eq('id', id)
      .single();
    if (error || !doc) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    if (!['queued', 'failed', 'partial', 'completed'].includes(doc.processing_status))
      return NextResponse.json(
        { error: `Document cannot be retried from state ${doc.processing_status}.` },
        { status: 409 },
      );
    await db
      .from('ledgerlens_documents')
      .update({ processing_status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', id);
    await db.from('ledgerlens_audit_logs').insert({
      document_id: id,
      action: 'reprocess_requested',
      actor_type: 'human',
      actor_name: 'Workspace operator',
      description: 'Document queued for reprocessing.',
    });
    const result = await processQueuedDocument(id, 'reprocess');
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reprocessing failed.' },
      { status: 500 },
    );
  }
}
