# Architecture

## Request and data path

The Next.js App Router renders the portfolio workspace. Server API routes validate upload, webhook, and review input and use the Supabase JavaScript client with a server-side service-role credential. The UI reads either deterministic fixtures in Demo Mode or persisted LedgerLens invoices in Live Mode.

The document worker downloads the private source object, validates its signature, requests structured candidate fields from OpenAI when Live Mode is enabled, validates those fields with Zod, normalizes selected values, applies deterministic business rules, and writes invoice, line-item, validation, run, review, notification, and audit records to Supabase.

n8n and Resend are optional integrations. n8n may coordinate intake and downstream notifications. Resend can deliver review notifications. Neither service owns invoice validation or approval policy.

## Data ownership

LedgerLens tables use the ledgerlens_ prefix in public. Source documents use the private ledgerlens-invoice-documents bucket. The shared Supabase project also contains Northstar objects and a guestbook table used by Niven. The additive shared SQL is separate from the original per-app migrations because the applications do not share a Supabase CLI migration history.

## Security and trust boundaries

- Browser input, webhook payloads, uploaded files, and model output are untrusted.
- File size, declared MIME type, and bytes are checked before processing; model output must satisfy a strict schema.
- The service-role key bypasses RLS. RLS protects direct anon/authenticated table access but is not isolation between backends.
- Current API routes have no end-user authentication. Do not expose live processing or sensitive documents to the public.
- The webhook is unauthenticated when WEBHOOK_SECRET is blank.
- Live extraction sends the uploaded document to OpenAI. Optional email sends notification contents to Resend.

## Runtime limitations

Live upload and reprocessing execute synchronously. The upload routes declare a 120-second maximum duration; there is no durable job queue, scheduler, retry/backoff service, or dead-letter mechanism. The current design is suitable for a controlled portfolio demo with synthetic data, not a multi-tenant production finance system.

See TRD.md for integration and operations details, DATABASE_SCHEMA.md for schema, and IMPLEMENTATION_PLAN.md for verification status.
