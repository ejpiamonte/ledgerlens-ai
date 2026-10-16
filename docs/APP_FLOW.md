# Application and automation flow

## 1. Demo workspace

With DEMO_MODE unset or true, the UI reads a generated, fictional demo workspace (lib/demo-data.ts). Nothing in Demo Mode reads from or writes to Supabase.

- Two scenarios share one rules engine: Small business (Harbor & Pine Hospitality, about 110 invoices in 30 days) and Enterprise (Meridian Holdings, a 240-invoice sample of about 2,400 per month across USD, GBP, and EUR entities). Policies live in lib/scenarios.ts.
- The visitor picks a scenario with the top-bar switch, which sets the ll_scenario cookie. A link with ?scenario=smb or ?scenario=enterprise sets it and redirects (middleware.ts).
- Records come from a seeded generator and are evaluated by evaluateExtraction, the same function the live worker uses. Timestamps are relative to the current hour so the 30-day dashboard is always populated. Pinned showcase cases (clean, duplicate, bank-detail change, arithmetic mismatch, high value, unmatched PO, low confidence) drive the guided tour.
- Approve, reject, and reprocess work in Demo Mode. Decisions are stored only in the visitor's ll_demo_decisions cookie (most recent 12) and overlaid on the generated data. Reprocess clears the visitor's decision. POST /api/demo/reset clears all of them.
- Extraction is a fixture, not model output. No OpenAI, Resend, or n8n call is made.

## 2. Upload intake

The upload page sends multipart field file to POST /api/documents/upload. The API accepts non-empty PDF, PNG, and JPEG files up to 10 MiB, sanitizes the filename, and checks the file signature against the declared MIME type.

- Invalid form/file/type/signature returns HTTP 400.
- Live Mode without OPENAI_API_KEY returns HTTP 503 before storage.
- Storage or database setup failures return a service error.
- In Live Mode, on successful Storage upload, document metadata and a receipt audit entry are written.
- In Demo Mode the file is validated (type, size, signature), then fields are simulated and run through the real rules. The response contains the decision, checks, and step trace. The file is not stored and Supabase is not required.
- In Live Mode the same request calls the worker synchronously and returns the worker decision.

If document metadata insert fails, the route attempts to remove the uploaded object.

## 3. Webhook intake

POST /api/webhook/document validates filename, base64, MIME type, and source. It decodes the content, enforces the 10 MiB size limit, verifies the file signature, and stores it in the private bucket.

If WEBHOOK_SECRET is non-empty, the route requires Authorization: Bearer with the configured value. If it is blank, the endpoint accepts requests without authentication. Configure a strong secret before exposing the endpoint.

Demo Mode stores the document queued without extraction. Live Mode invokes the same worker as browser upload. n8n may call this API after its own metadata validation.

## 4. Live worker

1. Require Live Mode and OPENAI_API_KEY.
2. Load a document in queued, failed, or partial state as permitted by the caller.
3. Read configured rule thresholds from ledgerlens_app_settings, with code defaults when missing or invalid.
4. Claim the document using a state-conditional update to reduce concurrent duplicate processing.
5. Create an automation run record.
6. Check MIME, size, stored bytes, and file signature; download from private Storage.
7. Send the PDF/image and extraction instructions to OpenAI Responses API with storage disabled for that request.
8. Parse JSON and validate the strict extraction schema.
9. Normalize vendor/currency values; upsert vendor; check duplicate and purchase-order records.
10. Evaluate deterministic checks and choose auto-process or human review.
11. Upsert invoice, replace its line items and validation records, update document state, and create or resolve the review item.
12. Attempt notification delivery, log audit events, and finalize run steps.

Extraction output is candidate data only. It cannot approve an invoice by itself.

## 5. Decision branches and failures

- A clean, high-confidence, low-risk invoice with all required and critical checks passing can be auto-processed.
- Missing required data, failed arithmetic/date/currency/PO checks, duplicates, suspicious signals, high value, or uncertain extraction route to review.
- Invalid model JSON/schema is recorded as a partial run and high-priority review exception when persistence succeeds.
- Provider, storage, or persistence failures mark processing failed when the worker can write failure state and audit data.
- Notification failures do not reverse a saved financial decision; the run can be marked partial.
- A compare-and-set claim prevents a second worker from processing a document already claimed.
- Reprocess is a synchronous user action, not a background queue. The route resets eligible records to queued before calling the worker.

The app has no general automatic retry scheduler or dead-letter queue. Operators must correct configuration/data and use reprocess.

## 6. Human review

An operator reviews extracted values, source preview, validations, and recorded reason. Approval or rejection updates invoice/document/review records and records actor, timestamp, note, audit entry, and a logged notification.

The current operator routes do not authenticate the caller. Do not use them with real financial records on an internet-facing deployment.

## 7. Optional integrations

- Resend sends email only when Live Mode, API key, sender, and recipient are all configured. Otherwise a mock/log notification is written.
- n8n can validate external intake, call the app webhook, route outcomes, and call configured downstream notification endpoints. Keep financial rules and persistence in LedgerLens.
- OpenAI, Resend, n8n, and Supabase live behavior must be tested separately from the mocked worker suite.
