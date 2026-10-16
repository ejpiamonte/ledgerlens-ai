import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyConfidence,
  decide,
  evaluateExtraction,
  extractionSchema,
  isDuplicate,
  isIsoDate,
  normalizeName,
  validateArithmetic,
  validateDates,
} from '../lib/validation';
import { getDemoInvoices, simulateUpload } from '../lib/demo-data';
import { summarize } from '../lib/insights';
import { hasMatchingFileSignature } from '../lib/extraction/file-validation';
import { extractInvoice, ExtractionError } from '../lib/extraction/openai';
import { processQueuedDocument } from '../lib/automation/worker';
import { isDemoMode } from '../lib/config';
const cleanExtraction = {
  vendor_name: { value: 'Test Vendor', confidence: 0.99 },
  invoice_number: { value: 'T-1', confidence: 0.99 },
  invoice_date: { value: '2026-10-01', confidence: 0.99 },
  due_date: { value: '2026-11-01', confidence: 0.99 },
  po_number: { value: 'PO-1001', confidence: 0.99 },
  currency: { value: 'USD', confidence: 0.99 },
  subtotal: { value: 100, confidence: 0.99 },
  tax: { value: 8, confidence: 0.99 },
  total: { value: 108, confidence: 0.99 },
  payment_terms: null,
  line_items: [{ description: 'Test service', quantity: 1, unit_price: 100, amount: 100, confidence: 0.99 }],
  confidence: 0.99,
  missing_fields: [],
  suspicious_signals: [],
  extraction_notes: '',
};
type Row = Record<string, unknown>;
class MemoryQuery implements PromiseLike<{ data: unknown; error: null }> {
  private operation = 'select';
  private values: Row[] = [];
  private filters: { column: string; op: string; value: unknown }[] = [];
  private singleResult: 'single' | 'maybeSingle' | null = null;
  constructor(
    private readonly owner: MemoryDatabase,
    private readonly table: string,
  ) {}
  select() {
    return this;
  }
  insert(value: Row | Row[]) {
    this.operation = 'insert';
    this.values = Array.isArray(value) ? value : [value];
    return this;
  }
  upsert(value: Row | Row[]) {
    this.operation = 'upsert';
    this.values = Array.isArray(value) ? value : [value];
    return this;
  }
  update(value: Row) {
    this.operation = 'update';
    this.values = [value];
    return this;
  }
  delete() {
    this.operation = 'delete';
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }
  ilike(column: string, value: unknown) {
    this.filters.push({ column, op: 'ilike', value });
    return this;
  }
  not(column: string, op: string, value: unknown) {
    this.filters.push({ column, op: `not-${op}`, value });
    return this;
  }
  in(column: string, value: unknown[]) {
    this.filters.push({ column, op: 'in', value });
    return this;
  }
  single() {
    this.singleResult = 'single';
    return this.execute();
  }
  maybeSingle() {
    this.singleResult = 'maybeSingle';
    return this.execute();
  }
  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
  private matches(row: Row) {
    return this.filters.every((f) => {
      const value = row[f.column];
      if (f.op === 'eq') return value === f.value;
      if (f.op === 'neq') return value !== f.value;
      if (f.op === 'ilike') return String(value).toLowerCase() === String(f.value).toLowerCase();
      if (f.op === 'in') return (f.value as unknown[]).includes(value);
      if (f.op === 'not-is') return value !== null;
      return false;
    });
  }
  private execute(): Promise<{ data: unknown; error: null }> {
    let rows = this.owner.tables.get(this.table) ?? [];
    const affected: Row[] = [];
    if (this.operation === 'insert') {
      for (const value of this.values) {
        const row = { ...value, id: value.id ?? `id-${++this.owner.sequence}` };
        rows.push(row);
        affected.push(row);
      }
    } else if (this.operation === 'upsert') {
      const key =
        this.table === 'ledgerlens_vendors'
          ? 'normalized_name'
          : this.table === 'ledgerlens_invoices'
            ? 'document_id'
            : this.table === 'ledgerlens_review_queue'
              ? 'document_id'
              : 'id';
      for (const value of this.values) {
        const found = rows.find((row) => row[key] === value[key]);
        if (found) {
          Object.assign(found, value);
          affected.push(found);
        } else {
          const row = { ...value, id: value.id ?? `id-${++this.owner.sequence}` };
          rows.push(row);
          affected.push(row);
        }
      }
    } else if (this.operation === 'update') {
      for (const row of rows.filter((r) => this.matches(r))) {
        Object.assign(row, this.values[0]);
        affected.push(row);
      }
    } else if (this.operation === 'delete') {
      this.owner.tables.set(
        this.table,
        rows.filter((row) => !this.matches(row)),
      );
      rows = this.owner.tables.get(this.table)!;
    }
    const result = this.operation === 'select' ? rows.filter((row) => this.matches(row)) : affected;
    const data = this.singleResult ? (result[0] ?? null) : result;
    return Promise.resolve({ data, error: null });
  }
}
class MemoryDatabase {
  tables = new Map<string, Row[]>();
  sequence = 0;
  storage = { from: () => ({ download: async () => ({ data: new Blob(['%PDF-1.7 test']), error: null }) }) };
  from(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return new MemoryQuery(this, table);
  }
  seed(table: string, row: Row) {
    const rows = this.tables.get(table) ?? [];
    rows.push(row);
    this.tables.set(table, rows);
    return this;
  }
}
const DEMO_NOW = new Date('2026-10-17T12:00:00Z');

describe('deterministic business rules', () => {
  it('accepts arithmetic within tolerance and flags mismatches', () => {
    assert.equal(validateArithmetic(100, 8, 108), true);
    assert.equal(validateArithmetic(100, 8, 108.03), false);
  });
  it('compares due date to invoice date', () => {
    assert.equal(validateDates('2026-01-01', '2026-01-02'), true);
    assert.equal(validateDates('2026-01-03', '2026-01-02'), false);
    assert.equal(validateDates('2026-01-03', null), true);
  });
  it('detects duplicate on normalized vendor, invoice number, and amount', () => {
    const invoices = getDemoInvoices('smb', DEMO_NOW);
    const first = invoices.find((i) => i.showcase === 'duplicate-original')!;
    assert.equal(
      isDuplicate(
        {
          vendor: 'Copperline-Packaging',
          invoiceNumber: first.invoiceNumber.toLowerCase(),
          total: first.total,
        },
        invoices,
      ),
      true,
    );
    assert.equal(
      isDuplicate(
        { vendor: first.vendor, invoiceNumber: first.invoiceNumber, total: first.total + 3 },
        invoices,
      ),
      false,
    );
  });
  it('classifies confidence at configured boundaries', () => {
    assert.equal(classifyConfidence(0.9), 'low');
    assert.equal(classifyConfidence(0.89), 'medium');
    assert.equal(classifyConfidence(0.69), 'high');
  });
  it('never auto-processes duplicates, failures, high value, or uncertainty', () => {
    assert.equal(decide('low', 0, 100, false).status, 'auto_processed');
    assert.equal(decide('low', 0, 100, true).status, 'review_required');
    assert.equal(decide('low', 1, 100, false).risk, 'high');
    assert.equal(decide('low', 0, 30000, false).status, 'review_required');
    assert.equal(decide('medium', 0, 100, false).status, 'review_required');
  });
  it('normalizes vendor names deterministically', () =>
    assert.equal(normalizeName('A&B Supply, Inc.'), 'absupplyinc'));
  it('rejects malformed structured extraction', () =>
    assert.equal(extractionSchema.safeParse({ vendor_name: 'invented' }).success, false));
  it('validates ISO invoice dates and rejects impossible calendar values', () => {
    assert.equal(isIsoDate('2026-10-09'), true);
    assert.equal(isIsoDate('2026-02-30'), false);
    assert.equal(isIsoDate('09/10/2026'), false);
  });
  it('sends uncertain or failed candidates to review and only clears a clean invoice', () => {
    const candidate = extractionSchema.parse(cleanExtraction);
    assert.equal(evaluateExtraction(candidate, { duplicate: false, poValid: true }).status, 'auto_processed');
    assert.equal(evaluateExtraction(candidate, { duplicate: true, poValid: true }).risk, 'high');
    assert.equal(
      evaluateExtraction(candidate, { duplicate: false, poValid: false }).status,
      'review_required',
    );
    assert.equal(
      evaluateExtraction({ ...candidate, confidence: 0.82 }, { duplicate: false, poValid: true }).risk,
      'medium',
    );
    assert.equal(
      evaluateExtraction(
        { ...candidate, total: { value: 200, confidence: 0.9 } },
        { duplicate: false, poValid: true },
      ).status,
      'review_required',
    );
  });
  it('checks actual document signatures, not only a declared MIME type', () => {
    assert.equal(hasMatchingFileSignature(new TextEncoder().encode('%PDF-1.7'), 'application/pdf'), true);
    assert.equal(hasMatchingFileSignature(new TextEncoder().encode('not-a-pdf'), 'application/pdf'), false);
  });
  it('sends PDF bytes to the Responses API and validates its JSON before returning it', async () => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
    let requestBody = '';
    const result = await extractInvoice(
      { bytes: new TextEncoder().encode('%PDF-1.7'), mimeType: 'application/pdf', filename: 'test.pdf' },
      async (_url, init) => {
        requestBody = String(init?.body);
        return new Response(JSON.stringify({ output_text: JSON.stringify(cleanExtraction) }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    );
    const request = JSON.parse(requestBody);
    assert.equal(result.extraction.invoice_number.value, 'T-1');
    assert.equal(request.input[0].content[0].type, 'input_file');
    assert.match(request.input[0].content[0].file_data, /^data:application\/pdf;base64,/);
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });
  it('preserves invalid model JSON for a review exception without exposing credentials', async () => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
    await assert.rejects(
      () =>
        extractInvoice(
          { bytes: new Uint8Array([0xff, 0xd8, 0xff]), mimeType: 'image/jpeg', filename: 'x.jpg' },
          async () => new Response(JSON.stringify({ output_text: '{"unexpected":true}' }), { status: 200 }),
        ),
      (error: unknown) => error instanceof ExtractionError && error.rawOutput === '{"unexpected":true}',
    );
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });
  it('keeps the worker from processing fixtures as if they were live AI results', async () => {
    const previousMode = process.env.DEMO_MODE,
      previousKey = process.env.OPENAI_API_KEY;
    process.env.DEMO_MODE = 'true';
    process.env.OPENAI_API_KEY = 'test-key';
    await assert.rejects(() => processQueuedDocument('demo-doc-id'), /disabled in Demo Mode/);
    if (previousMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousMode;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });
  it('defaults to Demo Mode unless Live Mode is explicitly enabled', () => {
    const previous = process.env.DEMO_MODE;
    delete process.env.DEMO_MODE;
    assert.equal(isDemoMode(), true);
    process.env.DEMO_MODE = 'false';
    assert.equal(isDemoMode(), false);
    if (previous === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previous;
  });
  it('runs queued documents through extraction, persistence, review, schema exceptions, and failure tracking', async () => {
    const previousMode = process.env.DEMO_MODE,
      previousKey = process.env.OPENAI_API_KEY,
      previousTo = process.env.REVIEW_EMAIL_TO;
    process.env.DEMO_MODE = 'false';
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.REVIEW_EMAIL_TO;
    const db = new MemoryDatabase();
    const settings = [
      ['arithmetic_tolerance', 0.02],
      ['duplicate_tolerance', 0.02],
      ['high_value_threshold', 25000],
      ['auto_process_confidence', 0.9],
      ['review_confidence_threshold', 0.7],
    ];
    db.tables.set(
      'ledgerlens_app_settings',
      settings.map(([key, value]) => ({ key, value })),
    );
    db.tables.set('ledgerlens_purchase_orders', [
      {
        id: 'po-1',
        po_number: 'PO-1001',
        status: 'open',
        approved_amount: 10000,
        currency: 'USD',
        vendor_id: null,
      },
    ]);
    const fetcher: typeof fetch = async () =>
      new Response(JSON.stringify({ output_text: JSON.stringify(cleanExtraction) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    try {
      for (const id of ['doc-clean', 'doc-duplicate', 'doc-invalid', 'doc-failed'])
        db.seed('ledgerlens_documents', {
          id,
          filename: `${id}.pdf`,
          file_type: 'application/pdf',
          file_size: 100,
          storage_path: `${id}/file.pdf`,
          source: 'test',
          processing_status: 'queued',
          status: 'received',
        });
      const injectedDb = db as unknown as never;
      const clean = await processQueuedDocument('doc-clean', 'upload', { db: injectedDb, fetcher });
      assert.equal(clean.status, 'auto_processed');
      assert.equal(db.tables.get('ledgerlens_invoices')?.[0]?.approval_status, 'approved');
      assert.equal(
        db.tables.get('ledgerlens_documents')?.find((row) => row.id === 'doc-clean')?.processing_status,
        'completed',
      );
      assert.equal(db.tables.get('ledgerlens_automation_runs')?.[0]?.status, 'completed');
      assert.equal(db.tables.get('ledgerlens_audit_logs')?.[0]?.action, 'invoice_auto_processed');
      assert.equal(db.tables.get('ledgerlens_notifications')?.[0]?.is_mock, true);
      assert.equal(db.tables.get('ledgerlens_invoice_line_items')?.[0]?.description, 'Test service');
      await db.from('ledgerlens_documents').update({ processing_status: 'queued' }).eq('id', 'doc-clean');
      const retried = await processQueuedDocument('doc-clean', 'reprocess', { db: injectedDb, fetcher });
      assert.equal(retried.status, 'auto_processed');
      assert.equal(
        db.tables.get('ledgerlens_invoices')?.filter((row) => row.document_id === 'doc-clean').length,
        1,
      );
      const duplicate = await processQueuedDocument('doc-duplicate', 'webhook', { db: injectedDb, fetcher });
      assert.equal(duplicate.status, 'review_required');
      assert.equal(duplicate.risk, 'high');
      assert.equal(db.tables.get('ledgerlens_review_queue')?.[0]?.document_id, 'doc-duplicate');
      assert.equal(
        db.tables.get('ledgerlens_documents')?.find((row) => row.id === 'doc-duplicate')?.review_status,
        'pending',
      );
      assert.equal(
        db.tables
          .get('ledgerlens_validation_results')
          ?.find((row) => row.invoice_id === duplicate.invoiceId && row.validation_type === 'duplicate')
          ?.status,
        'failed',
      );
      const malformed = await processQueuedDocument('doc-invalid', 'upload', {
        db: injectedDb,
        fetcher: async () =>
          new Response(JSON.stringify({ output_text: '{"invented":true}' }), { status: 200 }),
      });
      assert.equal(malformed.status, 'review_required');
      assert.equal(
        db.tables.get('ledgerlens_documents')?.find((row) => row.id === 'doc-invalid')?.processing_status,
        'partial',
      );
      assert.equal(
        db.tables.get('ledgerlens_automation_runs')?.find((row) => row.document_id === 'doc-invalid')?.status,
        'partial',
      );
      assert.equal(
        db.tables.get('ledgerlens_review_queue')?.find((row) => row.document_id === 'doc-invalid')?.priority,
        'high',
      );
      await assert.rejects(
        () =>
          processQueuedDocument('doc-failed', 'upload', {
            db: injectedDb,
            fetcher: async () => new Response('unavailable', { status: 503 }),
          }),
        /processing failed/i,
      );
      assert.equal(
        db.tables.get('ledgerlens_documents')?.find((row) => row.id === 'doc-failed')?.processing_status,
        'failed',
      );
      assert.equal(
        db.tables.get('ledgerlens_automation_runs')?.find((row) => row.document_id === 'doc-failed')?.status,
        'failed',
      );
    } finally {
      if (previousMode === undefined) delete process.env.DEMO_MODE;
      else process.env.DEMO_MODE = previousMode;
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
      if (previousTo === undefined) delete process.env.REVIEW_EMAIL_TO;
      else process.env.REVIEW_EMAIL_TO = previousTo;
    }
  });
});

describe('demo workspace', () => {
  it('is deterministic for the same hour', () => {
    const a = getDemoInvoices('enterprise', DEMO_NOW).map((i) => `${i.id}:${i.total}:${i.status}`);
    const b = getDemoInvoices('enterprise', new Date(DEMO_NOW.getTime() + 60_000)).map(
      (i) => `${i.id}:${i.total}:${i.status}`,
    );
    assert.deepEqual(a, b);
  });

  it('puts every showcase case in the state the guided tour expects', () => {
    for (const scenario of ['smb', 'enterprise'] as const) {
      const rows = getDemoInvoices(scenario, DEMO_NOW);
      const byCase = (key: string) => rows.find((i) => i.showcase === key)!;
      assert.equal(byCase('clean').status, 'auto_processed');
      assert.equal(byCase('duplicate-original').status, 'auto_processed');
      for (const [key, kind] of [
        ['duplicate', 'duplicate'],
        ['suspicious', 'suspicious'],
        ['arithmetic', 'arithmetic'],
        ['high-value', 'high_value'],
        ['po', 'purchase_order'],
        ['confidence', 'confidence'],
      ] as const) {
        assert.equal(byCase(key).status, 'review_required', `${scenario}/${key} should be open`);
        assert.equal(byCase(key).exception, kind, `${scenario}/${key} exception`);
      }
    }
  });

  it('never auto-approves an invoice that failed a check or crossed the approval threshold', () => {
    for (const scenario of ['smb', 'enterprise'] as const) {
      for (const i of getDemoInvoices(scenario, DEMO_NOW)) {
        if (i.status !== 'auto_processed') continue;
        assert.ok(
          i.validations.every((v) => v.status === 'passed'),
          `${i.id} auto-approved with a failed check`,
        );
      }
    }
  });

  it('routes enterprise approvals by amount', () => {
    const rows = getDemoInvoices('enterprise', DEMO_NOW);
    assert.equal(rows.find((i) => i.showcase === 'high-value')!.approver, 'Financial controller');
    assert.equal(rows.find((i) => i.showcase === 'po')!.approver, 'AP specialist');
  });

  it('summarises a populated 30-day window', () => {
    const s = summarize(getDemoInvoices('smb', DEMO_NOW), DEMO_NOW.getTime());
    assert.equal(s.daily.length, 30);
    assert.ok(s.touchlessRate > 0.5 && s.touchlessRate < 0.95);
    assert.ok(s.open >= 6);
  });

  it('simulates an upload without touching storage', () => {
    const result = simulateUpload('smb', 'scan.pdf', 2048);
    assert.equal(result.filename, 'scan.pdf');
    assert.equal(result.steps?.length, 8);
  });
});
