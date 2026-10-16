import type { ExceptionKind, Risk, Status } from './types';

export type Tone = 'green' | 'amber' | 'red' | 'blue' | '';

export const STATUS_LABEL: Record<Status, string> = {
  auto_processed: 'Auto-approved',
  approved: 'Approved by reviewer',
  review_required: 'Needs review',
  rejected: 'Rejected',
  processing_failed: 'Processing failed',
};

export const STATUS_TONE: Record<Status, Tone> = {
  auto_processed: 'green',
  approved: 'blue',
  review_required: 'amber',
  rejected: 'red',
  processing_failed: 'red',
};

export const RISK_LABEL: Record<Risk, string> = { low: 'Low', medium: 'Medium', high: 'High' };
export const RISK_TONE: Record<Risk, Tone> = { low: 'green', medium: 'amber', high: 'red' };

export const EXCEPTION_LABEL: Record<ExceptionKind, string> = {
  duplicate: 'Possible duplicate',
  arithmetic: 'Totals do not reconcile',
  purchase_order: 'PO not matched',
  high_value: 'Above approval threshold',
  confidence: 'Low extraction confidence',
  suspicious: 'Suspicious document signal',
  dates: 'Invalid dates',
  missing_fields: 'Missing required fields',
};

export const CHECK_LABEL: Record<string, string> = {
  required_fields: 'Required fields',
  arithmetic: 'Arithmetic',
  dates: 'Dates',
  purchase_order: 'Purchase order',
  duplicate: 'Duplicate check',
  suspicious_signals: 'Suspicious signals',
  currency: 'Currency',
  high_value: 'Approval threshold',
  confidence: 'Extraction confidence',
};

export const checkLabel = (key: string) => CHECK_LABEL[key] ?? key.replaceAll('_', ' ');

export const confidenceTone = (confidence: number, auto = 0.9, review = 0.7): Tone =>
  confidence >= auto ? 'green' : confidence >= review ? 'amber' : 'red';

/** What a reviewer should actually do for each kind of exception. */
export const REVIEW_GUIDANCE: Record<ExceptionKind, string> = {
  duplicate:
    'Compare with the earlier invoice. Reject if it is the same delivery; approve only if the vendor confirms a separate charge.',
  arithmetic:
    'Recalculate from the line items. Ask the vendor for a corrected invoice rather than paying the printed total.',
  purchase_order:
    'Confirm the purchase with the budget owner and reference the correct open PO, or reject and return it to the requester.',
  high_value:
    'The amount is above the auto-approval limit. Confirm budget and that goods or services were received before approving.',
  confidence:
    'Compare the highlighted fields with the source document and correct anything that was misread before approving.',
  suspicious:
    'Do not use contact details printed on the invoice. Call the vendor on a known number to verify the bank change.',
  dates: 'Check the payment terms in the vendor contract and confirm the correct due date.',
  missing_fields: 'Complete the missing fields from the vendor record or request a reissued invoice.',
};
