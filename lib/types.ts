export type Risk = 'low' | 'medium' | 'high';
export type Status = 'auto_processed' | 'approved' | 'review_required' | 'rejected' | 'processing_failed';

export type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  confidence: number;
};

export type ValidationCheck = {
  name: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
};

export type RunStep = {
  key: string;
  label: string;
  status: 'success' | 'warning' | 'skipped' | 'failed';
  durationMs: number;
  detail: string;
};

export type AuditEvent = {
  at: string;
  actor: string;
  action: string;
  description: string;
};

/** Why an invoice was held for a person. Used for exception analytics. */
export type ExceptionKind =
  | 'duplicate'
  | 'arithmetic'
  | 'purchase_order'
  | 'high_value'
  | 'confidence'
  | 'suspicious'
  | 'dates'
  | 'missing_fields';

export type Invoice = {
  id: string;
  documentId: string;
  filename: string;
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  poNumber: string | null;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  confidence: number;
  risk: Risk;
  status: Status;
  reason: string;
  lineItems: LineItem[];
  validations: ValidationCheck[];
  createdAt: string;
  source: string;

  // Demo-workspace enrichment. Optional because live Supabase rows do not carry these fields.
  entity?: string;
  vendorCategory?: string;
  totalUsd?: number;
  exception?: ExceptionKind | null;
  approver?: string;
  fieldConfidence?: Partial<
    Record<'vendor' | 'invoiceNumber' | 'invoiceDate' | 'dueDate' | 'poNumber' | 'total', number>
  >;
  steps?: RunStep[];
  audit?: AuditEvent[];
  decidedAt?: string | null;
  decidedBy?: string | null;
  decisionNote?: string | null;
  processingMs?: number;
  showcase?: string;
};
