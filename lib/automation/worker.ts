import { getAdminClient } from '@/lib/supabase/server';
import { extractInvoice, ExtractionError } from '@/lib/extraction/openai';
import { hasMatchingFileSignature } from '@/lib/extraction/file-validation';
import { evaluateExtraction, normalizeName } from '@/lib/validation';
import { isDemoMode } from '@/lib/config';
import type { Extraction } from '@/lib/validation';
import type { RunStep } from '@/lib/types';

type DocumentRow = {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  source: string;
  processing_status: string;
};
export type WorkerDependencies = { db?: ReturnType<typeof getAdminClient>; fetcher?: typeof fetch };
type WorkerResult = {
  documentId: string;
  invoiceId: string | null;
  status: string;
  risk: string;
  reason: string;
  runId: string;
};
const now = () => new Date().toISOString();
function step(key: string, label: string, status: RunStep['status'], start: number, detail: string): RunStep {
  return { key, label, status, durationMs: Date.now() - start, detail };
}
async function audit(
  db: ReturnType<typeof getAdminClient>,
  documentId: string,
  action: string,
  description: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await db.from('ledgerlens_audit_logs').insert({
    document_id: documentId,
    action,
    actor_type: 'system',
    actor_name: 'LedgerLens worker',
    description,
    metadata,
  });
  if (error) throw new Error('Audit event could not be persisted.');
}

async function completeRun(
  db: ReturnType<typeof getAdminClient>,
  runId: string,
  started: number,
  status: string,
  steps: RunStep[],
  error: string | null = null,
  invoiceId: string | null = null,
) {
  const { error: runError } = await db
    .from('ledgerlens_automation_runs')
    .update({
      invoice_id: invoiceId,
      status,
      error,
      duration_ms: Date.now() - started,
      completed_at: now(),
      steps,
    })
    .eq('id', runId);
  if (runError) throw new Error('Automation run could not be finalized.');
}

async function createNotification(
  db: ReturnType<typeof getAdminClient>,
  doc: DocumentRow,
  invoiceId: string,
  invoice: Extraction,
  status: string,
  reason: string,
) {
  const auto = status === 'auto_processed',
    subject = auto
      ? `Invoice ${invoice.invoice_number.value} processed automatically`
      : `Invoice ${invoice.invoice_number.value ?? doc.filename} requires review`;
  const body = auto
    ? `Invoice ${invoice.invoice_number.value} from ${invoice.vendor_name.value} was processed automatically.`
    : `Invoice ${invoice.invoice_number.value ?? doc.filename} requires human review: ${reason}`;
  const apiKey = process.env.RESEND_API_KEY,
    from = process.env.EMAIL_FROM,
    to = process.env.REVIEW_EMAIL_TO;
  let delivery: { status: string; provider: string; is_mock: boolean } = {
    status: 'logged',
    provider: 'demo-log',
    is_mock: true,
  };
  if (!isDemoMode() && apiKey && from && to) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, text: body }),
        signal: AbortSignal.timeout(15_000),
      });
      delivery = { status: res.ok ? 'sent' : 'failed', provider: 'resend', is_mock: false };
    } catch {
      delivery = { status: 'failed', provider: 'resend', is_mock: false };
    }
  }
  const { error } = await db.from('ledgerlens_notifications').insert({
    document_id: doc.id,
    invoice_id: invoiceId,
    recipient: to ?? null,
    notification_type: auto ? 'auto_processed' : 'review_required',
    subject,
    body,
    status: delivery.status,
    provider: delivery.provider,
    is_mock: delivery.is_mock,
  });
  if (error) return { status: 'failed', provider: 'notification log', is_mock: true };
  return delivery;
}

async function saveSchemaException(
  db: ReturnType<typeof getAdminClient>,
  doc: DocumentRow,
  runId: string,
  runStarted: number,
  steps: RunStep[],
  raw: string | null,
  message: string,
): Promise<WorkerResult> {
  const start = Date.now();
  const { data: inv, error } = await db
    .from('ledgerlens_invoices')
    .upsert(
      {
        document_id: doc.id,
        confidence: 0,
        extraction_status: 'failed',
        approval_status: 'pending',
        risk_level: 'high',
        raw_extraction: raw ? { output: raw.slice(0, 20000) } : null,
        normalized_data: { missing_fields: ['all fields'], extraction_notes: message },
        updated_at: now(),
      },
      { onConflict: 'document_id' },
    )
    .select('id')
    .single();
  if (error) throw new Error('Could not persist the extraction exception.');
  await db.from('ledgerlens_validation_results').delete().eq('invoice_id', inv.id);
  const { error: validationError } = await db.from('ledgerlens_validation_results').insert({
    invoice_id: inv.id,
    validation_type: 'extraction_schema',
    status: 'failed',
    severity: 'critical',
    message: 'Structured extraction failed schema validation. Human review is required.',
    metadata: { diagnostic: message },
  });
  if (validationError) throw new Error('Could not persist the schema validation failure.');
  const { error: reviewError } = await db.from('ledgerlens_review_queue').upsert(
    {
      document_id: doc.id,
      invoice_id: inv.id,
      reason:
        'The extracted document fields could not be validated. Inspect the source and correct the invoice manually.',
      priority: 'high',
      status: 'pending',
    },
    { onConflict: 'document_id' },
  );
  if (reviewError) throw new Error('Could not create the extraction exception review item.');
  const { error: docError } = await db
    .from('ledgerlens_documents')
    .update({
      status: 'review_required',
      processing_status: 'partial',
      review_status: 'pending',
      updated_at: now(),
    })
    .eq('id', doc.id);
  if (docError) throw new Error('Could not update document review state.');
  await audit(
    db,
    doc.id,
    'extraction_schema_failed',
    'Extraction output did not pass the strict schema; document sent to review.',
  );
  steps.push(
    step(
      'validate_extraction',
      'Validate structured output',
      'failed',
      start,
      'Strict invoice schema check failed.',
    ),
  );
  await completeRun(
    db,
    runId,
    runStarted,
    'partial',
    steps,
    'Structured extraction requires human correction.',
    inv.id,
  );
  return {
    documentId: doc.id,
    invoiceId: inv.id,
    status: 'review_required',
    risk: 'high',
    reason: 'Structured extraction needs manual correction.',
    runId,
  };
}

export async function processQueuedDocument(
  documentId: string,
  trigger: 'upload' | 'webhook' | 'reprocess' = 'upload',
  dependencies: WorkerDependencies = {},
): Promise<WorkerResult> {
  if (isDemoMode())
    throw new Error(
      'Live document processing is disabled in Demo Mode. The seeded sample invoices are deterministic. Set DEMO_MODE=false to run extraction.',
    );
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required to process a queued invoice.');
  const db = dependencies.db ?? getAdminClient(),
    started = Date.now(),
    steps: RunStep[] = [];
  const { data: doc, error: loadError } = await db
    .from('ledgerlens_documents')
    .select('id,filename,file_type,file_size,storage_path,source,processing_status')
    .eq('id', documentId)
    .single();
  if (loadError || !doc) throw new Error('Queued document was not found.');
  const document = doc as DocumentRow;
  const { data: settingRows } = await db
    .from('ledgerlens_app_settings')
    .select('key,value')
    .in('key', [
      'arithmetic_tolerance',
      'duplicate_tolerance',
      'high_value_threshold',
      'auto_process_confidence',
      'review_confidence_threshold',
    ]);
  const settings = new Map((settingRows ?? []).map((row) => [row.key, Number(row.value)]));
  const setting = (key: string, fallback: number) => {
    const value = settings.get(key);
    return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
  };
  const arithmeticTolerance = setting('arithmetic_tolerance', 0.02),
    duplicateTolerance = setting('duplicate_tolerance', 0.02),
    highValueThreshold = setting('high_value_threshold', 25000),
    autoConfidenceThreshold = setting('auto_process_confidence', 0.9),
    reviewConfidenceThreshold = setting('review_confidence_threshold', 0.7);
  if (!['queued', 'processing_failed', 'partial'].includes(document.processing_status))
    throw new Error(`Document is not queued for processing (state: ${document.processing_status}).`);
  const { data: claim, error: claimError } = await db
    .from('ledgerlens_documents')
    .update({ processing_status: 'processing', status: 'processing', updated_at: now() })
    .eq('id', documentId)
    .eq('processing_status', document.processing_status)
    .select('id')
    .maybeSingle();
  if (claimError) throw new Error('Could not claim this document for processing.');
  if (!claim) throw new Error('Another worker has already claimed this document.');
  const { data: run, error: runError } = await db
    .from('ledgerlens_automation_runs')
    .insert({
      document_id: documentId,
      trigger,
      mode: 'live',
      status: 'running',
      ai_provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      started_at: now(),
      steps: [],
    })
    .select('id')
    .single();
  if (runError || !run) {
    await db
      .from('ledgerlens_documents')
      .update({ processing_status: 'queued', status: 'received' })
      .eq('id', documentId);
    throw new Error('Could not start an automation run record.');
  }
  try {
    let tick = Date.now();
    if (
      !['application/pdf', 'image/png', 'image/jpeg'].includes(document.file_type) ||
      document.file_size > 10 * 1024 * 1024
    )
      throw new Error('Stored document type or size is not supported.');
    steps.push(
      step(
        'validate_file',
        'Validate file',
        'success',
        tick,
        'Supported document type and maximum size verified.',
      ),
    );
    tick = Date.now();
    const { data: file, error: fileError } = await db.storage
      .from('ledgerlens-invoice-documents')
      .download(document.storage_path);
    if (fileError || !file) throw new Error('Stored document could not be retrieved.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasMatchingFileSignature(bytes, document.file_type))
      throw new Error('The stored file signature does not match its declared document type.');
    steps.push(
      step(
        'extract_content',
        'Retrieve and inspect document',
        'success',
        tick,
        'Private source document loaded and its file signature verified.',
      ),
    );
    tick = Date.now();
    let extraction: Extraction, raw: string, model: string;
    try {
      ({ extraction, raw, model } = await extractInvoice(
        { bytes, mimeType: document.file_type, filename: document.filename },
        dependencies.fetcher,
      ));
    } catch (error) {
      if (error instanceof ExtractionError && error.rawOutput)
        return await saveSchemaException(
          db,
          document,
          run.id,
          started,
          steps,
          error.rawOutput,
          error.message,
        );
      throw error;
    }
    steps.push(
      step(
        'ai_extraction',
        'Extract invoice fields',
        'success',
        tick,
        'OpenAI returned candidate fields; no approval decision was made.',
      ),
    );
    await db.from('ledgerlens_automation_runs').update({ model }).eq('id', run.id);
    tick = Date.now();
    const vendor = extraction.vendor_name.value?.trim() || null,
      invoiceNumber = extraction.invoice_number.value?.trim() || null,
      invoiceDate = extraction.invoice_date.value,
      dueDate = extraction.due_date.value,
      poNumber = extraction.po_number.value?.trim() || null,
      currency = extraction.currency.value?.trim().toUpperCase() || null,
      subtotal = extraction.subtotal.value,
      tax = extraction.tax.value,
      total = extraction.total.value;
    steps.push(
      step(
        'normalize',
        'Normalize invoice fields',
        'success',
        tick,
        'Vendor name, currency, and null values normalized.',
      ),
    );

    let vendorId: string | null = null;
    if (vendor) {
      const normalizedName = normalizeName(vendor);
      const { data: vendorRow, error: vendorError } = await db
        .from('ledgerlens_vendors')
        .upsert(
          {
            name: vendor,
            normalized_name: normalizedName,
            default_currency: currency ?? 'USD',
            updated_at: now(),
          },
          { onConflict: 'normalized_name' },
        )
        .select('id')
        .single();
      if (vendorError || !vendorRow) throw new Error('Vendor record could not be persisted.');
      vendorId = vendorRow.id;
    }

    let duplicate = false;
    if (vendorId && invoiceNumber && total !== null) {
      const { data: previous, error: duplicateError } = await db
        .from('ledgerlens_invoices')
        .select('document_id,invoice_number,total')
        .eq('vendor_id', vendorId)
        .ilike('invoice_number', invoiceNumber)
        .neq('document_id', documentId)
        .not('total', 'is', null);
      if (duplicateError) throw new Error('Duplicate check could not be completed.');
      duplicate = (previous ?? []).some((item) => Math.abs(Number(item.total) - total) <= duplicateTolerance);
    }
    let poValid = false;
    if (poNumber) {
      const { data: po, error: poError } = await db
        .from('ledgerlens_purchase_orders')
        .select('id,vendor_id,approved_amount,currency')
        .eq('po_number', poNumber)
        .eq('status', 'open')
        .maybeSingle();
      if (poError) throw new Error('Purchase-order check could not be completed.');
      poValid = Boolean(
        po &&
          (!po.vendor_id || po.vendor_id === vendorId) &&
          (!po.approved_amount || total === null || total <= Number(po.approved_amount)) &&
          (!po.currency || po.currency === currency),
      );
    }
    const evaluated = evaluateExtraction(extraction, {
      duplicate,
      poValid,
      arithmeticTolerance,
      highValueThreshold,
      autoConfidenceThreshold,
      reviewConfidenceThreshold,
    });
    const { checks: validation, risk, status, reason, failures } = evaluated;
    steps.push(
      step(
        'validate_financials',
        'Validate invoice and business rules',
        failures || risk === 'high' ? 'warning' : 'success',
        tick,
        `${validation.filter((v) => v.status === 'passed').length} checks passed; ${failures} checks failed.`,
      ),
    );
    tick = Date.now();
    const approval = status === 'auto_processed' ? 'approved' : 'pending';
    const normalized = {
      vendor_name: vendor,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      po_number: poNumber,
      currency,
      subtotal,
      tax,
      total,
      payment_terms: extraction.payment_terms,
      line_items: extraction.line_items,
      confidence: extraction.confidence,
      missing_fields: extraction.missing_fields,
      suspicious_signals: extraction.suspicious_signals,
      extraction_notes: extraction.extraction_notes,
    };
    const { data: invoice, error: invoiceError } = await db
      .from('ledgerlens_invoices')
      .upsert(
        {
          document_id: documentId,
          vendor_id: vendorId,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          po_number: poNumber,
          currency,
          subtotal,
          tax,
          total,
          confidence: extraction.confidence,
          extraction_status: 'complete',
          approval_status: approval,
          risk_level: risk,
          raw_extraction: JSON.parse(raw),
          normalized_data: normalized,
          updated_at: now(),
        },
        { onConflict: 'document_id' },
      )
      .select('id')
      .single();
    if (invoiceError || !invoice) throw new Error('Validated invoice could not be persisted.');
    await db.from('ledgerlens_invoice_line_items').delete().eq('invoice_id', invoice.id);
    if (extraction.line_items.length) {
      const items = extraction.line_items.map((item) => ({ ...item, invoice_id: invoice.id }));
      const { error } = await db.from('ledgerlens_invoice_line_items').insert(items);
      if (error) throw new Error('Invoice line items could not be persisted.');
    }
    await db.from('ledgerlens_validation_results').delete().eq('invoice_id', invoice.id);
    const validationRows = validation.map((v) => ({
      ...v,
      invoice_id: invoice.id,
      expected_value: v.expected_value ?? null,
      actual_value: v.actual_value ?? null,
      metadata: v.metadata ?? {},
    }));
    const { error: validationError } = await db.from('ledgerlens_validation_results').insert(validationRows);
    if (validationError) throw new Error('Validation results could not be persisted.');
    if (status === 'review_required') {
      const { error } = await db.from('ledgerlens_review_queue').upsert(
        {
          document_id: documentId,
          invoice_id: invoice.id,
          reason,
          priority: risk === 'high' ? 'high' : 'normal',
          status: 'pending',
        },
        { onConflict: 'document_id' },
      );
      if (error) throw new Error('Invoice could not be added to the review queue.');
    } else {
      await db
        .from('ledgerlens_review_queue')
        .update({ status: 'resolved', reviewed_by: 'LedgerLens rules engine', reviewed_at: now() })
        .eq('document_id', documentId)
        .eq('status', 'pending');
    }
    const { error: docError } = await db
      .from('ledgerlens_documents')
      .update({
        status,
        processing_status: 'completed',
        review_status: status === 'review_required' ? 'pending' : 'not_required',
        updated_at: now(),
      })
      .eq('id', documentId);
    if (docError) throw new Error('Document decision state could not be persisted.');
    await audit(
      db,
      documentId,
      status === 'auto_processed' ? 'invoice_auto_processed' : 'invoice_routed_to_review',
      reason,
      { risk, confidence: extraction.confidence },
    );
    steps.push(
      step(
        'persist',
        'Persist invoice and decision',
        'success',
        tick,
        'Invoice, line items, validation outcomes, review routing, and audit event saved.',
      ),
    );
    tick = Date.now();
    const notification = await createNotification(db, document, invoice.id, extraction, status, reason);
    steps.push(
      step(
        'notify',
        'Log notification',
        notification.status === 'failed' ? 'warning' : 'success',
        tick,
        notification.status === 'failed'
          ? 'Invoice saved; notification or notification logging failed.'
          : notification.is_mock
            ? 'Notification recorded as a demo log.'
            : `Notification ${notification.status} through ${notification.provider}.`,
      ),
    );
    await completeRun(
      db,
      run.id,
      started,
      notification.status === 'failed' ? 'partial' : 'completed',
      steps,
      notification.status === 'failed' ? 'Invoice decision saved; notification delivery failed.' : null,
      invoice.id,
    );
    return { documentId, invoiceId: invoice.id, status, risk, reason, runId: run.id };
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'Unexpected processing failure.';
    await db
      .from('ledgerlens_invoices')
      .update({ approval_status: 'pending' })
      .eq('document_id', documentId)
      .eq('approval_status', 'approved');
    await db
      .from('ledgerlens_documents')
      .update({ status: 'processing_failed', processing_status: 'failed', updated_at: now() })
      .eq('id', documentId);
    steps.push({
      key: 'processing_failure',
      label: 'Handle processing failure',
      status: 'failed',
      durationMs: 0,
      detail: 'Processing stopped safely. Review the run diagnostic and retry.',
    });
    await audit(db, documentId, 'processing_failed', 'Document processing failed; no invoice was approved.', {
      diagnostic: safeMessage.slice(0, 500),
    });
    await completeRun(db, run.id, started, 'failed', steps, safeMessage.slice(0, 500));
    throw new Error(
      'Document processing failed. The run and safe diagnostic were recorded; retry the document after correcting the issue.',
    );
  }
}
