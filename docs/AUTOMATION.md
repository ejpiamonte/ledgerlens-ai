# Automation lifecycle

## Demo Mode

The workspace displays six deterministic fictional invoice fixtures. They are not model output. An uploaded document is stored in Supabase and left queued; Demo Mode does not invoke OpenAI. The upload route still requires Supabase credentials and the private bucket.

## Live Mode

The worker processes the document synchronously:

1. Load the queued document and read the configured thresholds.
2. Claim the document with a state-conditional update and create an automation run.
3. Download the object and verify MIME type, size, and file signature.
4. Request candidate invoice fields from OpenAI Responses API.
5. Parse the response and require the strict extraction schema.
6. Normalize vendor and currency values and check duplicate and purchase-order records.
7. Apply deterministic rules and persist invoice, line items, validations, and decision state.
8. Add exceptions to the review queue or resolve a previous pending review.
9. Record notifications, audit events, and run steps.

Extraction/schema failures become review exceptions when the exception records can be saved. Other processing errors set a failed state when persistence is available. Notification delivery failure does not reverse the financial decision; it can leave the run partial.

## Human review and retry

An operator can approve or reject a pending invoice. Rejection requires a reason. The routes update invoice, document, and review state and write audit and notification records. Reprocess resets an eligible record and invokes the worker immediately. These routes currently do not authenticate the caller.

## n8n

The included workflow validates basic metadata, calls LedgerLens webhook intake, branches on review_required, and optionally calls notification endpoints. Configure the environment variables named in the workflow. If WEBHOOK_SECRET is unset in LedgerLens, the target endpoint does not authenticate requests.

n8n coordinates; LedgerLens remains the source of truth for extraction, deterministic financial checks, persistence, and invoice decisions.
