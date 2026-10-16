import { unstable_noStore as noStore } from 'next/cache';
import { getDemoInvoices, scenarioOfId } from '@/lib/demo-data';
import { applyDecisions, getDemoDecisions, getScenario } from '@/lib/demo-state';
import { getAdminClient } from './server';
import { isDemoMode } from '@/lib/config';
import type { Invoice, LineItem, Risk, Status } from '@/lib/types';
import type { ScenarioId } from '@/lib/scenarios';

type InvoiceRow = {
  id: string;
  document_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  po_number: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  confidence: number | null;
  risk_level: string | null;
  approval_status: string | null;
  extraction_status: string | null;
  created_at: string;
  vendors: { name: string } | null;
  documents: {
    filename: string;
    source: string;
    created_at: string;
    status: string;
    review_status: string;
  } | null;
};
export type ValidationRecord = {
  validation_type: string;
  status: string;
  severity: string;
  message: string;
  expected_value: unknown;
  actual_value: unknown;
  metadata: Record<string, unknown>;
};

function mapRow(row: InvoiceRow): Invoice {
  const documentStatus = row.documents?.status;
  const status: Status =
    row.approval_status === 'rejected'
      ? 'rejected'
      : row.approval_status === 'approved'
        ? documentStatus === 'auto_processed'
          ? 'auto_processed'
          : 'approved'
        : documentStatus === 'processing_failed'
          ? 'processing_failed'
          : 'review_required';
  return {
    id: row.id,
    documentId: row.document_id,
    filename: row.documents?.filename ?? 'Invoice document',
    vendor: row.vendors?.name ?? 'Unknown vendor',
    invoiceNumber: row.invoice_number ?? 'Missing invoice number',
    invoiceDate: row.invoice_date ?? '—',
    dueDate: row.due_date,
    poNumber: row.po_number,
    currency: row.currency ?? 'USD',
    subtotal: Number(row.subtotal ?? 0),
    tax: Number(row.tax ?? 0),
    total: Number(row.total ?? 0),
    confidence: Number(row.confidence ?? 0),
    risk: (row.risk_level ?? 'high') as Risk,
    status,
    reason: 'Open the invoice to see the recorded validation and decision.',
    lineItems: [],
    validations: [],
    createdAt: row.documents?.created_at ?? row.created_at,
    source: row.documents?.source ?? 'Upload',
  };
}

/** Demo invoices for the visitor's scenario with their own review decisions applied. */
async function getDemoWorkspace(scenarioId?: ScenarioId): Promise<Invoice[]> {
  const id = scenarioId ?? (await getScenario()).id;
  return applyDecisions(getDemoInvoices(id), await getDemoDecisions());
}

export async function getWorkspaceInvoices(): Promise<Invoice[]> {
  noStore();
  if (isDemoMode()) return getDemoWorkspace();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from('ledgerlens_invoices')
      .select(
        'id,document_id,invoice_number,invoice_date,due_date,po_number,currency,subtotal,tax,total,confidence,risk_level,approval_status,extraction_status,created_at,vendors:ledgerlens_vendors(name),documents:ledgerlens_documents!inner(filename,source,created_at,status,review_status)',
      )
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    const records = data as unknown as InvoiceRow[],
      documentIds = records.map((row) => row.document_id);
    const { data: reviews } = documentIds.length
      ? await db.from('ledgerlens_review_queue').select('document_id,reason').in('document_id', documentIds)
      : { data: [] };
    const reasons = new Map((reviews ?? []).map((row) => [row.document_id, row.reason]));
    return records.map((row) => ({
      ...mapRow(row),
      reason: String(
        reasons.get(row.document_id) ?? 'Open the invoice to see the recorded validation and decision.',
      ),
    }));
  } catch {
    return [];
  }
}

export async function getWorkspaceInvoice(id: string): Promise<Invoice | null> {
  // Demo ids carry their scenario, so deep links keep working after the visitor switches scenario.
  const demoScenario = isDemoMode() ? scenarioOfId(id) : null;
  const invoices = demoScenario ? await getDemoWorkspace(demoScenario) : await getWorkspaceInvoices();
  return invoices.find((invoice) => invoice.id === id || invoice.documentId === id) ?? null;
}
export async function getInvoiceExtra(documentId: string) {
  if (isDemoMode() || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return null;
  try {
    const db = getAdminClient(),
      { data: invoice } = await db
        .from('ledgerlens_invoices')
        .select('id,raw_extraction,normalized_data')
        .eq('document_id', documentId)
        .single();
    if (!invoice) return null;
    const invoiceId = invoice.id;
    const [
      { data: items },
      { data: validations },
      { data: runs },
      { data: audit },
      { data: notifications },
      { data: review },
      { data: document },
    ] = await Promise.all([
      db
        .from('ledgerlens_invoice_line_items')
        .select('description,quantity,unit_price,amount,confidence')
        .eq('invoice_id', invoiceId),
      db
        .from('ledgerlens_validation_results')
        .select('validation_type,status,severity,message,expected_value,actual_value,metadata')
        .eq('invoice_id', invoiceId)
        .order('created_at'),
      db
        .from('ledgerlens_automation_runs')
        .select('id,trigger,mode,status,duration_ms,error,started_at,completed_at,steps')
        .eq('document_id', documentId)
        .order('started_at', { ascending: false }),
      db
        .from('ledgerlens_audit_logs')
        .select('action,actor_type,actor_name,description,created_at')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false }),
      db
        .from('ledgerlens_notifications')
        .select('notification_type,status,subject,created_at')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false }),
      db
        .from('ledgerlens_review_queue')
        .select('reason,priority,status,reviewed_by,reviewed_at,notes,created_at')
        .eq('document_id', documentId)
        .maybeSingle(),
      db.from('ledgerlens_documents').select('storage_path').eq('id', documentId).single(),
    ]);
    let previewUrl: string | undefined;
    if (document?.storage_path) {
      const { data } = await db.storage
        .from('ledgerlens-invoice-documents')
        .createSignedUrl(document.storage_path, 900);
      previewUrl = data?.signedUrl;
    }
    return {
      raw: invoice.raw_extraction ?? null,
      normalized: invoice.normalized_data ?? null,
      items: (items ?? []) as LineItem[],
      validations: (validations ?? []) as ValidationRecord[],
      runs: runs ?? [],
      audit: audit ?? [],
      notifications: notifications ?? [],
      review: review ?? null,
      previewUrl,
    };
  } catch {
    return null;
  }
}
