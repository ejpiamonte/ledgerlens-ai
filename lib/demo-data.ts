/**
 * Deterministic demo workspace.
 *
 * Every invoice here is fictional. Records are synthesised from a seeded random generator and then
 * evaluated by the same rules engine the live worker uses (evaluateExtraction), so every decision on
 * screen is the decision the real rules would make. Timestamps are relative to the current hour so the
 * dashboard always shows a populated 30-day window.
 */
import { evaluateExtraction, isDuplicate, type Extraction } from './validation';
import { approverFor, SCENARIOS, toUsd, type Entity, type Scenario, type ScenarioId } from './scenarios';
import type { AuditEvent, ExceptionKind, Invoice, LineItem, RunStep, ValidationCheck } from './types';

type VendorSpec = {
  name: string;
  category: string;
  min: number;
  max: number;
  items: string[];
  recurring?: boolean;
  regions?: string[];
  weight?: number;
};

const SMB_VENDORS: VendorSpec[] = [
  {
    name: 'Coastal Produce Co.',
    category: 'Food & produce',
    min: 380,
    max: 2200,
    weight: 4,
    items: [
      'Mixed greens (case)',
      'Heirloom tomatoes (case)',
      'Citrus assortment (case)',
      'Fresh herbs (bunch)',
    ],
  },
  {
    name: 'Bayline Seafood',
    category: 'Food & produce',
    min: 600,
    max: 3800,
    weight: 3,
    items: ['Atlantic salmon (lb)', 'Shrimp 16/20 (lb)', 'Oysters (dozen)'],
  },
  {
    name: 'Copperline Packaging',
    category: 'Packaging',
    min: 250,
    max: 1600,
    weight: 2,
    items: ['Compostable takeout containers', 'Kraft carry bags', 'Compostable cutlery kits'],
  },
  {
    name: 'Summit Linen Service',
    category: 'Linen',
    min: 280,
    max: 520,
    recurring: true,
    weight: 2,
    items: ['Napkin service', 'Apron and towel service'],
  },
  {
    name: 'Metro Power & Light',
    category: 'Utilities',
    min: 900,
    max: 2400,
    recurring: true,
    items: ['Electricity service'],
  },
  {
    name: 'CityWater Utilities',
    category: 'Utilities',
    min: 180,
    max: 420,
    recurring: true,
    items: ['Water and sewer service'],
  },
  {
    name: 'Ember POS',
    category: 'Software',
    min: 189,
    max: 389,
    recurring: true,
    items: ['POS subscription', 'Online ordering module'],
  },
  {
    name: 'Northfield Beverage',
    category: 'Beverages',
    min: 500,
    max: 4200,
    weight: 3,
    items: ['Craft beer kegs', 'Wine (case)', 'Soda syrup (box)'],
  },
  {
    name: 'Ironline Kitchen Repair',
    category: 'Repairs & equipment',
    min: 250,
    max: 6800,
    items: ['Technician labor (hour)', 'Replacement parts', 'Call-out fee'],
  },
  {
    name: 'BrightSpark Cleaning',
    category: 'Cleaning',
    min: 640,
    max: 960,
    recurring: true,
    items: ['Nightly deep clean', 'Hood and duct cleaning'],
  },
  {
    name: 'Ledger & Co. Accounting',
    category: 'Professional services',
    min: 450,
    max: 850,
    recurring: true,
    items: ['Monthly bookkeeping', 'Payroll processing'],
  },
  {
    name: 'Harborview Marketing',
    category: 'Marketing',
    min: 300,
    max: 2500,
    items: ['Social media management', 'Menu photography', 'Local ads placement'],
  },
];

const ENTERPRISE_VENDORS: VendorSpec[] = [
  {
    name: 'Atlas Freight Partners',
    category: 'Logistics',
    min: 3000,
    max: 48000,
    weight: 3,
    items: ['Ocean freight', 'Drayage', 'Customs brokerage'],
  },
  {
    name: 'Northwind Logistics',
    category: 'Logistics',
    min: 1500,
    max: 25000,
    regions: ['US'],
    weight: 3,
    items: ['LTL freight', 'Warehousing (pallet-month)'],
  },
  {
    name: 'Channelside Haulage Ltd',
    category: 'Logistics',
    min: 1000,
    max: 18000,
    regions: ['UK'],
    weight: 2,
    items: ['Road haulage', 'Pallet storage'],
  },
  {
    name: 'Rheinfracht GmbH',
    category: 'Logistics',
    min: 1200,
    max: 22000,
    regions: ['DE'],
    weight: 2,
    items: ['Road freight', 'Cross-docking'],
  },
  {
    name: 'Stratus Cloud Services',
    category: 'Cloud & software',
    min: 4000,
    max: 42000,
    recurring: true,
    weight: 2,
    items: ['Compute reserved instances', 'Object storage', 'Support plan'],
  },
  {
    name: 'Keystone Data Systems',
    category: 'Cloud & software',
    min: 2000,
    max: 30000,
    regions: ['US'],
    items: ['Data warehouse licence', 'Implementation services'],
  },
  {
    name: 'Brightline CRM',
    category: 'Cloud & software',
    min: 1000,
    max: 12000,
    recurring: true,
    items: ['CRM seats (annual)', 'Sandbox add-on'],
  },
  {
    name: 'Harbor Industrial Supply',
    category: 'Raw materials',
    min: 2000,
    max: 55000,
    regions: ['US'],
    weight: 3,
    items: ['Steel coil', 'Safety equipment', 'Fasteners (box)'],
  },
  {
    name: 'Sheffield Alloys Ltd',
    category: 'Raw materials',
    min: 3000,
    max: 70000,
    regions: ['UK'],
    weight: 2,
    items: ['Aluminium sheet', 'Alloy bar stock'],
  },
  {
    name: 'Bavaria Polymer AG',
    category: 'Raw materials',
    min: 2500,
    max: 60000,
    regions: ['DE'],
    weight: 2,
    items: ['Polymer granulate (t)', 'Masterbatch'],
  },
  {
    name: 'Copperline Packaging',
    category: 'Packaging',
    min: 800,
    max: 14000,
    regions: ['US'],
    weight: 2,
    items: ['Shipping cartons', 'Stretch film', 'Void fill'],
  },
  {
    name: 'Pacific Corrugated',
    category: 'Packaging',
    min: 600,
    max: 9000,
    regions: ['US'],
    items: ['Corrugated boxes', 'Pallet wrap'],
  },
  {
    name: 'Northstar Office Co.',
    category: 'Office supplies',
    min: 150,
    max: 4000,
    weight: 2,
    items: ['Ergonomic chairs', 'Desk lamps', 'Stationery bundle'],
  },
  {
    name: 'Kestrel Facilities Management',
    category: 'Facilities',
    min: 3000,
    max: 28000,
    regions: ['US'],
    recurring: true,
    items: ['Facilities management fee', 'HVAC maintenance'],
  },
  {
    name: 'Thames Facility Services',
    category: 'Facilities',
    min: 2000,
    max: 20000,
    regions: ['UK'],
    recurring: true,
    items: ['Cleaning contract', 'Reception services'],
  },
  {
    name: 'Hausmeister Plus GmbH',
    category: 'Facilities',
    min: 1500,
    max: 15000,
    regions: ['DE'],
    recurring: true,
    items: ['Building services', 'Winter service'],
  },
  {
    name: 'Granite Legal LLP',
    category: 'Professional services',
    min: 5000,
    max: 45000,
    items: ['Legal services (hours)', 'Disbursements'],
  },
  {
    name: 'Whitmore & Lane Advisory',
    category: 'Professional services',
    min: 8000,
    max: 90000,
    items: ['Advisory retainer', 'Transaction support'],
  },
  {
    name: 'Clearview Audit Partners',
    category: 'Professional services',
    min: 10000,
    max: 75000,
    items: ['Interim audit fieldwork', 'Tax compliance review'],
  },
  {
    name: 'Beacon Media Group',
    category: 'Marketing',
    min: 2000,
    max: 40000,
    items: ['Paid media', 'Campaign production'],
  },
  {
    name: 'Lumen Creative Studio',
    category: 'Marketing',
    min: 1500,
    max: 22000,
    regions: ['UK'],
    items: ['Brand design', 'Video production'],
  },
  {
    name: 'Signal Telecom',
    category: 'Telecom',
    min: 1000,
    max: 9000,
    regions: ['US'],
    recurring: true,
    items: ['Mobile fleet plan', 'SD-WAN circuits'],
  },
  {
    name: 'EuroLink Telekom',
    category: 'Telecom',
    min: 800,
    max: 7000,
    regions: ['DE'],
    recurring: true,
    items: ['Fibre connectivity', 'Mobile plan'],
  },
  {
    name: 'Vertex Hardware Direct',
    category: 'IT hardware',
    min: 1000,
    max: 48000,
    weight: 2,
    items: ['Laptops', 'Docking stations', 'Network switches'],
  },
  {
    name: 'Apex Workstation Supply',
    category: 'IT hardware',
    min: 500,
    max: 20000,
    items: ['Monitors', 'Peripherals bundle'],
  },
  {
    name: 'TalentBridge Staffing',
    category: 'Staffing',
    min: 6000,
    max: 55000,
    regions: ['US'],
    items: ['Contract staff (hours)', 'Placement fee'],
  },
  {
    name: 'Albion Contract Staffing',
    category: 'Staffing',
    min: 4000,
    max: 40000,
    regions: ['UK'],
    items: ['Temporary staff (hours)'],
  },
  {
    name: 'Voyager Corporate Travel',
    category: 'Travel',
    min: 1000,
    max: 25000,
    items: ['Air travel', 'Hotel bookings', 'Agency fee'],
  },
  {
    name: 'Evergreen Energy',
    category: 'Utilities',
    min: 3000,
    max: 22000,
    regions: ['US'],
    recurring: true,
    items: ['Electricity supply'],
  },
  {
    name: 'Rheinland Energie',
    category: 'Utilities',
    min: 2500,
    max: 18000,
    regions: ['DE'],
    recurring: true,
    items: ['Strom und Gas'],
  },
  {
    name: 'SecureGate Security',
    category: 'Security services',
    min: 2000,
    max: 16000,
    recurring: true,
    items: ['Guarding services', 'Access control maintenance'],
  },
  {
    name: 'Quantum Lab Instruments',
    category: 'Equipment',
    min: 3000,
    max: 80000,
    items: ['Spectrometer', 'Calibration service'],
  },
  {
    name: 'Ridgeway Maintenance Co.',
    category: 'Maintenance',
    min: 800,
    max: 12000,
    regions: ['US'],
    items: ['Preventive maintenance', 'Emergency call-out'],
  },
  {
    name: 'Optima Print & Mail',
    category: 'Print',
    min: 400,
    max: 6000,
    items: ['Printed collateral', 'Mail fulfilment'],
  },
  {
    name: 'Crestline Insurance Brokers',
    category: 'Insurance',
    min: 5000,
    max: 60000,
    items: ['Property insurance premium', 'Broker fee'],
  },
  {
    name: 'Silverleaf Catering',
    category: 'Catering',
    min: 400,
    max: 5000,
    items: ['Event catering', 'Office lunch programme'],
  },
];

const SOURCES: Record<ScenarioId, [string, number][]> = {
  smb: [
    ['Email inbox', 0.7],
    ['Upload', 0.2],
    ['Mobile capture', 0.1],
  ],
  enterprise: [
    ['AP inbox', 0.55],
    ['Supplier portal', 0.25],
    ['EDI / API', 0.15],
    ['Upload', 0.05],
  ],
};

const SUSPICIOUS_SIGNAL = 'Remit-to bank account differs from the vendor master record';

/* ------------------------------------------------------------------ */
/* Seeded randomness                                                   */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const int = (rng: Rng, min: number, max: number) => Math.floor(between(rng, min, max + 1));
const pick = <T>(rng: Rng, items: T[]) => items[Math.floor(rng() * items.length)]!;
const round2 = (n: number) => Math.round(n * 100) / 100;

function weighted<T>(rng: Rng, items: [T, number][]): T {
  const total = items.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [item, w] of items) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return items.at(-1)![0];
}

/** Log-uniform amount: most invoices are small, a few are large, like real payables. */
const amountBetween = (rng: Rng, min: number, max: number) =>
  Math.exp(between(rng, Math.log(min), Math.log(max)));

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const prefixFor = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/* ------------------------------------------------------------------ */
/* Building one invoice                                                */
/* ------------------------------------------------------------------ */

type Draft = {
  id: string;
  vendor: VendorSpec;
  entity: Entity;
  invoiceNumber: string;
  receivedAt: number;
  invoiceDate: string;
  dueDate: string | null;
  poNumber: string | null;
  poValid: boolean;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  confidence: number;
  signals: string[];
  notes: string;
  source: string;
  fileExt: 'pdf' | 'png' | 'jpg';
  showcase?: string;
  forceDecision?: { status: 'approved' | 'rejected'; afterHours: number; note: string };
  keepOpen?: boolean;
};

function buildLineItems(rng: Rng, vendor: VendorSpec, target: number, confidence: number): LineItem[] {
  const count = Math.min(vendor.items.length, int(rng, 1, 3));
  const names = [...vendor.items].sort(() => rng() - 0.5).slice(0, count);
  const shares = names.map(() => between(rng, 0.5, 1.5));
  const shareTotal = shares.reduce((a, b) => a + b, 0);
  return names.map((description, k) => {
    const lineTarget = (target * shares[k]!) / shareTotal;
    const quantity = lineTarget > 400 ? int(rng, 1, 24) : int(rng, 1, 6);
    const unit_price = round2(lineTarget / quantity);
    return {
      description,
      quantity,
      unit_price,
      amount: round2(unit_price * quantity),
      confidence: round2(Math.min(0.99, confidence + between(rng, -0.04, 0.03))),
    };
  });
}

function exceptionFrom(
  checks: ReturnType<typeof evaluateExtraction>['checks'],
  overThreshold: boolean,
): ExceptionKind | null {
  const failed = (type: string) => checks.some((c) => c.validation_type === type && c.status === 'failed');
  if (failed('duplicate')) return 'duplicate';
  if (failed('suspicious_signals')) return 'suspicious';
  if (failed('arithmetic')) return 'arithmetic';
  if (failed('purchase_order')) return 'purchase_order';
  if (failed('dates')) return 'dates';
  if (failed('required_fields') || failed('currency')) return 'missing_fields';
  if (overThreshold) return 'high_value';
  return 'confidence';
}

const DECISION_NOTES: Record<ExceptionKind, { approved: string; rejected: string }> = {
  duplicate: {
    approved: 'Confirmed separate delivery; vendor reused the invoice number.',
    rejected: 'Duplicate of an invoice already posted. Vendor notified.',
  },
  arithmetic: {
    approved: 'Freight surcharge confirmed with vendor; total accepted.',
    rejected: 'Totals do not reconcile. Requested a corrected invoice.',
  },
  purchase_order: {
    approved: 'Matched to PO after budget owner confirmation.',
    rejected: 'No approved PO. Returned to requester.',
  },
  high_value: {
    approved: 'Within approved budget; signed off at the required approval level.',
    rejected: 'Spend not approved for this period.',
  },
  confidence: {
    approved: 'Fields verified against the source document.',
    rejected: 'Document illegible. Requested a clean copy.',
  },
  suspicious: {
    approved: 'Bank change verified by phone with a known vendor contact.',
    rejected: 'Bank change could not be verified. Escalated as possible fraud.',
  },
  dates: {
    approved: 'Corrected due date from contract terms.',
    rejected: 'Invalid dates. Requested a reissued invoice.',
  },
  missing_fields: {
    approved: 'Missing fields completed from the vendor record.',
    rejected: 'Required fields missing. Returned to vendor.',
  },
};

const REJECT_RATE: Record<ExceptionKind, number> = {
  duplicate: 0.9,
  suspicious: 0.6,
  arithmetic: 0.45,
  purchase_order: 0.25,
  dates: 0.4,
  missing_fields: 0.4,
  high_value: 0.05,
  confidence: 0.05,
};

function finalize(draft: Draft, scenario: Scenario, prior: Invoice[], now: number, rng: Rng): Invoice {
  const { vendor, entity } = draft;
  const thresholdLocal = scenario.highValueThresholdUsd / (toUsd(1, entity.currency) || 1);
  const extraction: Extraction = {
    vendor_name: { value: vendor.name, confidence: draft.confidence },
    invoice_number: { value: draft.invoiceNumber, confidence: draft.confidence },
    invoice_date: { value: draft.invoiceDate, confidence: draft.confidence },
    due_date: { value: draft.dueDate, confidence: draft.confidence },
    po_number: { value: draft.poNumber, confidence: draft.confidence },
    currency: { value: entity.currency, confidence: 0.99 },
    subtotal: { value: draft.subtotal, confidence: draft.confidence },
    tax: { value: draft.tax, confidence: draft.confidence },
    total: { value: draft.total, confidence: draft.confidence },
    payment_terms: 'Net 30',
    line_items: draft.lineItems,
    confidence: draft.confidence,
    missing_fields: [],
    suspicious_signals: draft.signals,
    extraction_notes: draft.notes,
  };
  const duplicate = isDuplicate(
    { vendor: vendor.name, invoiceNumber: draft.invoiceNumber, total: draft.total },
    prior,
  );
  const result = evaluateExtraction(extraction, {
    duplicate,
    poValid: draft.poValid,
    arithmeticTolerance: scenario.arithmeticTolerance,
    highValueThreshold: thresholdLocal,
    autoConfidenceThreshold: scenario.autoConfidence,
    reviewConfidenceThreshold: scenario.reviewConfidence,
  });

  const recurringExempt = scenario.poPolicy === 'recurring-exempt' && vendor.recurring && !draft.poNumber;
  const validations: ValidationCheck[] = result.checks.map((c) => ({
    name: c.validation_type,
    status: c.status,
    message:
      c.validation_type === 'purchase_order' && recurringExempt
        ? 'Recurring service vendor: PO not required by policy.'
        : c.message,
  }));
  const overThreshold = draft.total > thresholdLocal;
  validations.push({
    name: 'high_value',
    status: overThreshold ? 'warning' : 'passed',
    message: overThreshold
      ? `Total exceeds the ${formatUsd(scenario.highValueThresholdUsd)} approval threshold.`
      : `Below the ${formatUsd(scenario.highValueThresholdUsd)} approval threshold.`,
  });
  validations.push({
    name: 'confidence',
    status: draft.confidence >= scenario.autoConfidence ? 'passed' : 'warning',
    message: `Extraction confidence ${Math.round(draft.confidence * 100)}% (auto-approve at ${Math.round(scenario.autoConfidence * 100)}%+).`,
  });

  const totalUsd = round2(toUsd(draft.total, entity.currency));
  const exception = result.status === 'review_required' ? exceptionFrom(result.checks, overThreshold) : null;

  // Pipeline trace.
  const extractMs = int(rng, 2600, 8800);
  const steps: RunStep[] = [
    {
      key: 'receive',
      label: 'Receive document',
      status: 'success',
      durationMs: int(rng, 40, 180),
      detail: `${draft.source} · ${draft.fileExt.toUpperCase()}`,
    },
    {
      key: 'validate_file',
      label: 'Validate file',
      status: 'success',
      durationMs: int(rng, 8, 40),
      detail: 'Type, size, and file signature verified.',
    },
    {
      key: 'extract',
      label: 'Extract fields with AI',
      status: 'success',
      durationMs: extractMs,
      detail: `${draft.lineItems.length} line items · ${Math.round(draft.confidence * 100)}% confidence (demo fixture in place of a live model call)`,
    },
    {
      key: 'schema',
      label: 'Validate structured output',
      status: 'success',
      durationMs: int(rng, 3, 12),
      detail: 'Output matches the strict extraction schema.',
    },
    {
      key: 'normalize',
      label: 'Normalize data',
      status: 'success',
      durationMs: int(rng, 4, 20),
      detail: `Vendor matched · ${entity.currency} · ${entity.short}`,
    },
    {
      key: 'duplicate',
      label: 'Check for duplicates',
      status: duplicate ? 'warning' : 'success',
      durationMs: int(rng, 20, 90),
      detail: duplicate ? 'Same vendor, invoice number, and amount already on file.' : 'No prior match.',
    },
    {
      key: 'rules',
      label: 'Apply business rules',
      status: result.failures ? 'warning' : 'success',
      durationMs: int(rng, 10, 60),
      detail: result.failures ? `${result.failures} check(s) failed` : 'All deterministic checks passed.',
    },
    {
      key: 'route',
      label: 'Route decision',
      status: result.status === 'auto_processed' ? 'success' : 'warning',
      durationMs: int(rng, 10, 40),
      detail:
        result.status === 'auto_processed'
          ? 'Posted for payment without manual touch.'
          : `Held for ${approverFor(scenario, totalUsd)} review: ${result.reason}`,
    },
  ];
  const processingMs = steps.reduce((sum, s) => sum + s.durationMs, 0);
  const createdAt = new Date(draft.receivedAt).toISOString();

  // Lifecycle: older exceptions have usually been resolved by a person.
  let status = result.status as Invoice['status'];
  let decidedAt: string | null = null;
  let decidedBy: string | null = null;
  let decisionNote: string | null = null;
  const approver = approverFor(scenario, totalUsd);
  if (status === 'review_required' && exception && !draft.keepOpen) {
    const ageHours = (now - draft.receivedAt) / HOUR;
    const resolveChance = ageHours > 120 ? 1 : ageHours > 72 ? 0.94 : ageHours > 24 ? 0.6 : 0.12;
    const forced = draft.forceDecision;
    if (forced || rng() < resolveChance) {
      const rejected = forced ? forced.status === 'rejected' : rng() < REJECT_RATE[exception];
      const after = forced
        ? forced.afterHours
        : Math.min(ageHours - 0.5, between(rng, 0.5, scenario.reviewSlaHours * 1.3));
      status = rejected ? 'rejected' : 'approved';
      decidedAt = new Date(draft.receivedAt + Math.max(0.25, after) * HOUR).toISOString();
      decidedBy = reviewerFor(scenario, approver);
      decisionNote = forced?.note ?? DECISION_NOTES[exception][rejected ? 'rejected' : 'approved'];
    }
  }

  const audit: AuditEvent[] = [
    {
      at: createdAt,
      actor: 'LedgerLens intake',
      action: 'Document received',
      description: `Received via ${draft.source}.`,
    },
    {
      at: new Date(draft.receivedAt + extractMs).toISOString(),
      actor: 'AI extraction',
      action: 'Fields extracted',
      description: `Proposed values at ${Math.round(draft.confidence * 100)}% confidence. AI output is advisory.`,
    },
    {
      at: new Date(draft.receivedAt + processingMs).toISOString(),
      actor: 'Rules engine',
      action: result.status === 'auto_processed' ? 'Auto-approved' : 'Routed to review',
      description: result.reason,
    },
  ];
  if (decidedAt)
    audit.push({
      at: decidedAt,
      actor: decidedBy!,
      action: status === 'approved' ? 'Approved' : 'Rejected',
      description: decisionNote ?? '',
    });

  const low = draft.confidence < scenario.autoConfidence;
  return {
    id: draft.id,
    documentId: draft.id,
    filename: `${slug(vendor.name)}-${slug(draft.invoiceNumber)}.${draft.fileExt}`,
    vendor: vendor.name,
    vendorCategory: vendor.category,
    invoiceNumber: draft.invoiceNumber,
    invoiceDate: draft.invoiceDate,
    dueDate: draft.dueDate,
    poNumber: draft.poNumber,
    currency: entity.currency,
    subtotal: draft.subtotal,
    tax: draft.tax,
    total: draft.total,
    totalUsd,
    confidence: draft.confidence,
    risk: result.risk,
    status,
    reason: result.reason,
    exception,
    approver,
    entity: entity.name,
    lineItems: draft.lineItems,
    validations,
    fieldConfidence: {
      vendor: Math.min(0.99, draft.confidence + 0.04),
      invoiceNumber: draft.confidence,
      invoiceDate: draft.confidence,
      dueDate: low ? round2(draft.confidence - 0.12) : draft.confidence,
      poNumber: draft.confidence,
      total: Math.min(0.99, draft.confidence + 0.02),
    },
    steps,
    audit,
    decidedAt,
    decidedBy,
    decisionNote,
    processingMs,
    createdAt,
    source: draft.source,
    showcase: draft.showcase,
  };
}

function reviewerFor(scenario: Scenario, approver: string) {
  return (
    scenario.reviewers.find((r) => r.toLowerCase().includes(approver.split(' ').at(-1)!.toLowerCase())) ??
    scenario.reviewers[0]!
  );
}

const formatUsd = (n: number) => `$${n.toLocaleString('en-US')}`;

/* ------------------------------------------------------------------ */
/* Showcase cases: pinned, recent, and open so the guided tour works   */
/* ------------------------------------------------------------------ */

type CaseSpec = {
  key: string;
  vendor: string;
  entity?: string;
  hoursAgo: number;
  amount: number;
  confidence?: number;
  invoiceNumber: string;
  po: string | null | 'auto';
  poValid?: boolean;
  arithmeticDelta?: number;
  signals?: string[];
  notes: string;
  ext?: Draft['fileExt'];
  source?: string;
  keepOpen?: boolean;
  forceDecision?: Draft['forceDecision'];
};

const SHOWCASE: Record<ScenarioId, CaseSpec[]> = {
  smb: [
    {
      key: 'duplicate-original',
      vendor: 'Copperline Packaging',
      hoursAgo: 9 * 24 + 3,
      amount: 1360,
      invoiceNumber: 'CP-8832',
      po: 'auto',
      notes: 'Clean digital PDF.',
    },
    {
      key: 'clean',
      vendor: 'Coastal Produce Co.',
      hoursAgo: 1.5,
      amount: 1186.4,
      invoiceNumber: 'CPC-24117',
      po: 'auto',
      confidence: 0.98,
      notes: 'Clean digital PDF. All fields read with high confidence.',
    },
    {
      key: 'duplicate',
      vendor: 'Copperline Packaging',
      hoursAgo: 2.2,
      amount: 1360,
      invoiceNumber: 'CP-8832',
      po: 'auto',
      confidence: 0.96,
      ext: 'png',
      source: 'Mobile capture',
      notes: 'Photo of a paper invoice. Matches an invoice already posted 9 days ago.',
      keepOpen: true,
    },
    {
      key: 'suspicious',
      vendor: 'Metro Power & Light',
      hoursAgo: 3.4,
      amount: 1940,
      invoiceNumber: 'MPL-0098812',
      po: null,
      confidence: 0.95,
      signals: [SUSPICIOUS_SIGNAL],
      notes: 'Remittance section lists a new bank account.',
      keepOpen: true,
    },
    {
      key: 'arithmetic',
      vendor: 'Northfield Beverage',
      hoursAgo: 5,
      amount: 2140,
      invoiceNumber: 'NB-55120',
      po: 'auto',
      confidence: 0.94,
      arithmeticDelta: 500,
      notes: 'Printed total is $500 higher than subtotal plus tax.',
      keepOpen: true,
    },
    {
      key: 'high-value',
      vendor: 'Ironline Kitchen Repair',
      hoursAgo: 6.5,
      amount: 7480,
      invoiceNumber: 'IKR-3307',
      po: 'auto',
      confidence: 0.97,
      notes: 'Walk-in cooler compressor replacement.',
      keepOpen: true,
    },
    {
      key: 'po',
      vendor: 'Harborview Marketing',
      hoursAgo: 20,
      amount: 1850,
      invoiceNumber: 'HVM-2026-41',
      po: 'PO-DT-9999',
      poValid: false,
      confidence: 0.93,
      notes: 'References a purchase order that is not in the open PO list.',
      keepOpen: true,
    },
    {
      key: 'confidence',
      vendor: 'Summit Linen Service',
      hoursAgo: 30,
      amount: 412.5,
      invoiceNumber: 'SLS-7781',
      po: null,
      confidence: 0.81,
      ext: 'jpg',
      source: 'Mobile capture',
      notes: 'Creased photo; due date partially obscured.',
      keepOpen: true,
    },
  ],
  enterprise: [
    {
      key: 'duplicate-original',
      vendor: 'Atlas Freight Partners',
      entity: 'US',
      hoursAgo: 12 * 24,
      amount: 18750,
      invoiceNumber: 'AFP-90118',
      po: 'auto',
      notes: 'Received through the supplier portal.',
    },
    {
      key: 'clean',
      vendor: 'Stratus Cloud Services',
      entity: 'US',
      hoursAgo: 0.8,
      amount: 17200,
      invoiceNumber: 'SCS-INV-2026-1043',
      po: 'auto',
      confidence: 0.99,
      source: 'EDI / API',
      notes: 'Structured e-invoice. All fields high confidence.',
    },
    {
      key: 'duplicate',
      vendor: 'Atlas Freight Partners',
      entity: 'US',
      hoursAgo: 1.6,
      amount: 18750,
      invoiceNumber: 'AFP-90118',
      po: 'auto',
      confidence: 0.97,
      source: 'AP inbox',
      notes: 'Same invoice re-sent by email after portal submission.',
      keepOpen: true,
    },
    {
      key: 'suspicious',
      vendor: 'Vertex Hardware Direct',
      entity: 'UK',
      hoursAgo: 2.5,
      amount: 23800,
      invoiceNumber: 'VHD-UK-44821',
      po: 'auto',
      confidence: 0.96,
      signals: [SUSPICIOUS_SIGNAL],
      notes: 'Bank details changed versus vendor master.',
      keepOpen: true,
    },
    {
      key: 'arithmetic',
      vendor: 'Sheffield Alloys Ltd',
      entity: 'UK',
      hoursAgo: 4,
      amount: 31200,
      invoiceNumber: 'SAL-118302',
      po: 'auto',
      confidence: 0.95,
      arithmeticDelta: 1240,
      notes: 'VAT line does not reconcile with the stated total.',
      keepOpen: true,
    },
    {
      key: 'high-value',
      vendor: 'Whitmore & Lane Advisory',
      entity: 'US',
      hoursAgo: 5.5,
      amount: 78500,
      invoiceNumber: 'WLA-2026-0912',
      po: 'auto',
      confidence: 0.98,
      notes: 'Transaction support engagement, phase 2.',
      keepOpen: true,
    },
    {
      key: 'po',
      vendor: 'Harbor Industrial Supply',
      entity: 'US',
      hoursAgo: 9,
      amount: 8750,
      invoiceNumber: 'HI-2914',
      po: 'PO-US-9999',
      poValid: false,
      confidence: 0.93,
      notes: 'PO number not found in the US entity PO registry.',
      keepOpen: true,
    },
    {
      key: 'confidence',
      vendor: 'Rheinfracht GmbH',
      entity: 'DE',
      hoursAgo: 14,
      amount: 6420,
      invoiceNumber: 'RF-2026-7731',
      po: 'auto',
      confidence: 0.79,
      ext: 'jpg',
      source: 'AP inbox',
      notes: 'Scanned German-language invoice; low contrast.',
      keepOpen: true,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Workspace generation                                                */
/* ------------------------------------------------------------------ */

function entityFor(rng: Rng, scenario: Scenario, vendor: VendorSpec) {
  const eligible = scenario.entities.filter((e) => !vendor.regions || vendor.regions.includes(e.short));
  return pick(rng, eligible.length ? eligible : scenario.entities);
}

function poFor(scenario: Scenario, vendor: VendorSpec, entity: Entity, rng: Rng) {
  if (scenario.poPolicy === 'recurring-exempt' && vendor.recurring) return null;
  const code = scenario.id === 'smb' ? (entity.short === 'Downtown' ? 'DT' : 'WF') : entity.short;
  return `PO-${code}-${int(rng, 1000, 4999)}`;
}

function draftFrom(
  rng: Rng,
  scenario: Scenario,
  id: string,
  vendor: VendorSpec,
  entity: Entity,
  receivedAt: number,
  target: number,
  confidence: number,
): Draft {
  const lineItems = buildLineItems(rng, vendor, target, confidence);
  const subtotal = round2(lineItems.reduce((s, l) => s + l.amount, 0));
  const tax = round2(subtotal * entity.taxRate);
  const invoiceMs = receivedAt - int(rng, 0, 4) * DAY;
  return {
    id,
    vendor,
    entity,
    invoiceNumber: `${prefixFor(vendor.name)}-${int(rng, 10000, 99999)}`,
    receivedAt,
    invoiceDate: isoDate(invoiceMs),
    dueDate: isoDate(invoiceMs + pick(rng, [15, 30, 30, 45]) * DAY),
    poNumber: poFor(scenario, vendor, entity, rng),
    poValid: true,
    lineItems,
    subtotal,
    tax,
    total: round2(subtotal + tax),
    confidence,
    signals: [],
    notes: 'Digital PDF.',
    source: weighted(rng, SOURCES[scenario.id]),
    fileExt: weighted(rng, [
      ['pdf', 0.82],
      ['png', 0.08],
      ['jpg', 0.1],
    ] as [Draft['fileExt'], number][]),
  };
}

function caseDraft(rng: Rng, scenario: Scenario, spec: CaseSpec, now: number): Draft {
  const vendors = scenario.id === 'smb' ? SMB_VENDORS : ENTERPRISE_VENDORS;
  const vendor = vendors.find((v) => v.name === spec.vendor)!;
  const entity = scenario.entities.find((e) => e.short === spec.entity) ?? scenario.entities[0]!;
  const draft = draftFrom(
    rng,
    scenario,
    `${scenario.id}-${spec.key}`,
    vendor,
    entity,
    now - spec.hoursAgo * HOUR,
    spec.amount,
    spec.confidence ?? 0.97,
  );
  // Keep the pinned subtotal exact so the story is the same every time.
  const scale = spec.amount / (draft.subtotal || 1);
  draft.lineItems = draft.lineItems.map((l) => {
    const unit_price = round2(l.unit_price * scale);
    return { ...l, unit_price, amount: round2(unit_price * l.quantity) };
  });
  draft.subtotal = round2(draft.lineItems.reduce((s, l) => s + l.amount, 0));
  draft.tax = round2(draft.subtotal * entity.taxRate);
  draft.total = round2(draft.subtotal + draft.tax + (spec.arithmeticDelta ?? 0));
  draft.invoiceNumber = spec.invoiceNumber;
  draft.poNumber =
    spec.po === 'auto'
      ? scenario.poPolicy === 'required' || !vendor.recurring
        ? poFor({ ...scenario, poPolicy: 'required' }, vendor, entity, rng)
        : null
      : spec.po;
  draft.poValid = spec.poValid ?? true;
  draft.signals = spec.signals ?? [];
  draft.notes = spec.notes;
  draft.fileExt = spec.ext ?? 'pdf';
  draft.source = spec.source ?? draft.source;
  draft.showcase = spec.key;
  draft.keepOpen = spec.keepOpen;
  draft.forceDecision = spec.forceDecision;
  return draft;
}

function generate(scenarioId: ScenarioId, now: number): Invoice[] {
  const scenario = SCENARIOS[scenarioId];
  const vendors = scenarioId === 'smb' ? SMB_VENDORS : ENTERPRISE_VENDORS;
  const rng = mulberry32(scenarioId === 'smb' ? 20261 : 90417);
  const drafts: Draft[] = [];

  for (let n = 0; n < scenario.sampleSize; n++) {
    let dayOffset = int(rng, 0, 29);
    const weekday = new Date(now - dayOffset * DAY).getUTCDay();
    if ((weekday === 0 || weekday === 6) && rng() < 0.7) dayOffset = Math.min(29, dayOffset + 2);
    const receivedAt = now - dayOffset * DAY - int(rng, 1, 11) * HOUR - int(rng, 0, 59) * 60_000;
    const vendor = weighted(
      rng,
      vendors.map((v) => [v, v.weight ?? 1] as [VendorSpec, number]),
    );
    const entity = entityFor(rng, scenario, vendor);
    const confidenceRoll = rng();
    const confidence = round2(
      confidenceRoll < 0.86
        ? between(rng, 0.93, 0.99)
        : confidenceRoll < 0.96
          ? between(rng, 0.8, 0.91)
          : between(rng, 0.62, 0.74),
    );
    const target = amountBetween(rng, vendor.min, vendor.max) / (toUsd(1, entity.currency) || 1);
    const draft = draftFrom(
      rng,
      scenario,
      `${scenarioId}-${String(n + 1).padStart(4, '0')}`,
      vendor,
      entity,
      receivedAt,
      target,
      confidence,
    );

    // Real-world exceptions, at plausible rates.
    const roll = rng();
    if (roll < 0.03) {
      draft.total = round2(draft.total + pick(rng, [100, 250, 500, 1000]));
      draft.notes = 'Printed total does not equal subtotal plus tax.';
    } else if (roll < 0.065 && draft.poNumber) {
      draft.poNumber = draft.poNumber.replace(/\d{4}$/, String(int(rng, 8000, 9999)));
      draft.poValid = false;
      draft.notes = 'Referenced PO is not in the open PO registry.';
    } else if (roll < 0.08 && scenario.poPolicy === 'required') {
      draft.poNumber = null;
      draft.poValid = false;
      draft.notes = 'No purchase-order reference on the document.';
    } else if (roll < 0.1 && drafts.length > 4) {
      const original = drafts[int(rng, 0, drafts.length - 1)]!;
      if (original.receivedAt < receivedAt) {
        Object.assign(draft, {
          vendor: original.vendor,
          entity: original.entity,
          invoiceNumber: original.invoiceNumber,
          lineItems: original.lineItems,
          subtotal: original.subtotal,
          tax: original.tax,
          total: original.total,
          poNumber: original.poNumber,
          notes: 'Same invoice received a second time.',
        });
      }
    } else if (roll < 0.108) {
      draft.signals = [SUSPICIOUS_SIGNAL];
      draft.notes = 'Remittance details differ from the vendor master.';
    } else if (roll < 0.114) {
      draft.dueDate = isoDate(Date.parse(draft.invoiceDate) - 5 * DAY);
      draft.notes = 'Due date precedes the invoice date.';
    }
    drafts.push(draft);
  }

  const cases = SHOWCASE[scenarioId].map((spec) => caseDraft(rng, scenario, spec, now));
  const original = cases.find((c) => c.showcase === 'duplicate-original');
  const resent = cases.find((c) => c.showcase === 'duplicate');
  if (original && resent) {
    Object.assign(resent, {
      lineItems: original.lineItems,
      subtotal: original.subtotal,
      tax: original.tax,
      total: original.total,
      poNumber: original.poNumber,
    });
  }
  drafts.push(...cases);

  // Evaluate in arrival order so duplicate detection only sees invoices that arrived earlier.
  drafts.sort((a, b) => a.receivedAt - b.receivedAt);
  const invoices: Invoice[] = [];
  for (const draft of drafts) invoices.push(finalize(draft, scenario, invoices, now, rng));
  return invoices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const cache = new Map<string, Invoice[]>();

/** Demo invoices for a scenario, newest first. Stable within the hour. */
export function getDemoInvoices(scenarioId: ScenarioId, at: Date = new Date()): Invoice[] {
  const hour = Math.floor(at.getTime() / HOUR) * HOUR;
  const key = `${scenarioId}:${hour}`;
  let rows = cache.get(key);
  if (!rows) {
    rows = generate(scenarioId, hour);
    cache.clear();
    cache.set(key, rows);
  }
  return rows;
}

export const scenarioOfId = (id: string): ScenarioId | null =>
  id.startsWith('enterprise-') ? 'enterprise' : id.startsWith('smb-') ? 'smb' : null;

/** Simulated extraction for a file uploaded in Demo Mode (nothing is stored). */
export function simulateUpload(scenarioId: ScenarioId, filename: string, bytes: number): Invoice {
  const scenario = SCENARIOS[scenarioId];
  const seed = [...filename].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, bytes);
  const rng = mulberry32(seed);
  const vendors = scenarioId === 'smb' ? SMB_VENDORS : ENTERPRISE_VENDORS;
  const vendor = pick(rng, vendors);
  const entity = entityFor(rng, scenario, vendor);
  const now = Date.now();
  const confidence = round2(between(rng, 0.82, 0.98));
  const draft = draftFrom(
    rng,
    scenario,
    `upload-${Math.abs(seed)}`,
    vendor,
    entity,
    now,
    amountBetween(rng, vendor.min, vendor.max),
    confidence,
  );
  draft.notes = 'Demo Mode: fields are simulated for this file; no AI provider was called.';
  draft.keepOpen = true;
  draft.source = 'Upload';
  const invoice = finalize(draft, scenario, getDemoInvoices(scenarioId), now, rng);
  return { ...invoice, filename };
}
