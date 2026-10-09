# Business rules

These thresholds are portfolio defaults. A finance owner should approve changes before production use.

- **Confidence:** 90% or higher can be eligible for automation; 70–89% requires review; below 70% is high-priority review. Confidence never overrides a failed validation.
- **Arithmetic:** subtotal + tax must equal total within $0.02 to allow currency rounding.
- **Required data:** vendor, invoice number, invoice date, currency, and total must be present.
- **Dates:** a due date earlier than the invoice date is an exception.
- **Duplicates:** normalized vendor name, exact invoice number (case-insensitive), and total within $0.02 are compared. A match is never auto-approved.
- **Purchase orders:** when a PO is supplied, it must match the configured approved PO registry. Missing or unknown references require review.
- **High value:** totals above $25,000 require a human approver regardless of confidence.
- **Risk:** high applies to duplicates, critical missing fields, failed financial checks, invalid PO, confidence below 70%, or high value. Medium applies to confidence from 70–89% or optional-field uncertainty. Low requires high confidence and every critical check to pass.
- **Decision:** auto-process only at low risk with all required fields and critical validations passing, and no duplicate or high-value hold. Human reviewers own exceptions and rejection reasons are recorded.
