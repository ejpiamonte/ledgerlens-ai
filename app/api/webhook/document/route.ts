import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminClient } from '@/lib/supabase/server';
import { processQueuedDocument } from '@/lib/automation/worker';
import { hasMatchingFileSignature } from '@/lib/extraction/file-validation';
import { isDemoMode } from '@/lib/config';
export const maxDuration = 120;
const payload = z.object({
  filename: z.string().min(1).max(180),
  content_base64: z
    .string()
    .min(1)
    .max(14_000_000)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  content_type: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  source: z.string().max(80).default('webhook'),
});
export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  let body;
  try {
    body = payload.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: 'Provide a valid filename, supported content_type, and base64 document content.' },
      { status: 400 },
    );
  }
  const bytes = Buffer.from(body.content_base64, 'base64');
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024)
    return NextResponse.json({ error: 'Decoded file must be no larger than 10 MB.' }, { status: 413 });
  if (!hasMatchingFileSignature(bytes, body.content_type))
    return NextResponse.json(
      { error: 'File bytes do not match the declared document type.' },
      { status: 400 },
    );
  if (!isDemoMode() && !process.env.OPENAI_API_KEY)
    return NextResponse.json({ error: 'Live processing requires OPENAI_API_KEY.' }, { status: 503 });
  const id = crypto.randomUUID(),
    filename = body.filename.replace(/[\\/\0-\x1f]/g, '_').slice(0, 180) || 'invoice';
  try {
    const db = getAdminClient(),
      path = `${id}/${filename}`;
    const { error: storageError } = await db.storage
      .from('ledgerlens-invoice-documents')
      .upload(path, bytes, { contentType: body.content_type });
    if (storageError) throw storageError;
    const { error } = await db.from('ledgerlens_documents').insert({
      id,
      filename,
      original_filename: filename,
      file_type: body.content_type,
      file_size: bytes.length,
      storage_path: path,
      source: body.source,
      status: 'received',
      processing_status: 'queued',
      review_status: 'not_required',
    });
    if (error) {
      await db.storage.from('ledgerlens-invoice-documents').remove([path]);
      throw error;
    }
    await db.from('ledgerlens_audit_logs').insert({
      document_id: id,
      action: 'document_received',
      actor_type: 'system',
      actor_name: 'Webhook',
      description: 'Document received through authenticated ingestion endpoint.',
    });
    if (isDemoMode())
      return NextResponse.json(
        {
          ok: true,
          documentId: id,
          filename,
          status: 'queued',
          message: 'Stored securely; Demo Mode does not run live extraction.',
        },
        { status: 202 },
      );
    const result = await processQueuedDocument(id, 'webhook');
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Document intake or processing failed.',
        documentId: id,
      },
      { status: 500 },
    );
  }
}
