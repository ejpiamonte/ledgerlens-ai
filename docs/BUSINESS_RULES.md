# Business rules

These are portfolio defaults implemented in lib/validation.ts and lib/automation/worker.ts. A finance owner would need to approve policy changes before any real financial use.

- **Required fields:** vendor, invoice number, invoice date, currency, and total must be present.
- **Currency:** a non-null currency must be exactly three uppercase letters after normalization. The code does not verify membership in an official currency registry.
- **Arithmetic:** subtotal and tax must both be present, and subtotal plus tax must equal total within 0.02. The same numeric tolerance is used regardless of currency.
- **Dates:** invoice and due-date strings must be valid ISO dates; due date may not precede invoice date. A missing due date is permitted.
- **Purchase order:** a valid open purchase order is required. If the extracted reference is missing, unknown, closed, mismatched by configured vendor/currency, or above its approved amount, the check fails and routes to review.
- **Duplicate:** the worker matches vendor ID and invoice number case-insensitively, then compares total within configured duplicate tolerance (default 0.02). Matching documents are never auto-approved.
- **Confidence:** at or above 0.90 is low risk; 0.70 to below 0.90 is medium risk; below 0.70 is high risk. Thresholds can be read from ledgerlens_app_settings.
- **High value:** totals strictly greater than 25,000 require review regardless of confidence. This threshold is configurable.
- **Suspicious signals:** any signals returned by extraction fail the corresponding validation and require review.
- **Decision:** automatic processing requires low risk and zero failed checks, with no duplicate or high-value hold. All other cases require human review.
- **Schema failure:** malformed or incomplete model output is not accepted as invoice data. The worker records an extraction exception and routes it to high-priority review when persistence succeeds.

AI confidence and extracted values are advisory. They do not supersede deterministic failures or a human decision.
