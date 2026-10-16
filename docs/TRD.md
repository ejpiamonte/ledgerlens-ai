# Technical requirements and architecture

## Runtime and dependencies

- Next.js 15 App Router with React 19 and TypeScript.
- Supabase JavaScript client for PostgreSQL and Storage.
- Zod for request and extraction schema validation.
- OpenAI Responses API for optional live PDF/image extraction.
- Resend for optional email delivery.
- n8n workflow export for optional orchestration.
- Node.js 20.9 or newer is the documented local runtime target.

Versions are pinned by package.json and package-lock.json. The supported provider behavior should be rechecked when dependencies or provider APIs change.

## Components

- Server-rendered workspace pages read the generated demo workspace (lib/demo-data.ts, per-visitor scenario and decisions from cookies via lib/demo-state.ts) or persisted Supabase invoices.
- Analytics for the overview, vendors, and queue ordering are computed in lib/insights.ts. Formatting and status labels live in lib/format.ts and lib/labels.ts.
- API routes handle upload, webhook intake, health, review decisions, and reprocessing.
- Worker validates file bytes, extracts candidates, normalizes values, applies business rules, persists outcomes, routes review, and records run steps.
- Supabase is the system of record and private object store.
- n8n may coordinate intake and downstream notifications; it does not own financial decision rules.

## API surface

- POST /api/documents/upload accepts multipart field file.
- POST /api/webhook/document accepts JSON filename, content_type, content_base64, and optional source.
- POST /api/documents/{id}/approve accepts an optional reason.
- POST /api/documents/{id}/reject requires a reason of 3 to 1000 characters.
- POST /api/documents/{id}/reprocess retries an eligible stored document.
- GET /api/health reports mode and database availability. It checks access to ledgerlens_documents and returns no credentials.

See APP_FLOW.md for inputs, branches, and failure behavior.

## Configuration

- NEXT_PUBLIC_SUPABASE_URL is read only by server-side code in this project despite its conventional prefix.
- SUPABASE_SERVICE_ROLE_KEY is server-only and bypasses RLS. Never expose it to browser code.
- DEMO_MODE defaults to true. Set it to false only when the shared schema, Supabase credentials, and OpenAI configuration are ready.
- OPENAI_API_KEY and OPENAI_MODEL configure extraction. OpenAI API charges are separate from a ChatGPT subscription.
- WEBHOOK_SECRET is optional; when absent, webhook intake does not enforce bearer authentication.
- RESEND_API_KEY, EMAIL_FROM, and REVIEW_EMAIL_TO jointly enable email sending.
- N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET only feed the optional Settings status display; the app worker does not call n8n. The exported workflow must be imported, configured with its own n8n environment variables, and activated separately.

Use .env.local for local secrets. The checked-in .env.example contains placeholders only. Never copy real values into documentation, source control, issue reports, or screenshots.

## Security, privacy, and operations

- Supabase tables enable RLS; LedgerLens policies deny anon and authenticated access. The backend uses the shared service-role credential, which bypasses those policies.
- The shared project has multiple backends. A compromised service-role key can affect all schemas and Storage resources in that project; table prefixes do not isolate credentials.
- The Storage bucket is private and accepts PDF, PNG, and JPEG up to 10 MiB. Preview links are signed for a limited interval.
- No current API route enforces end-user authentication or authorization. Live routes must not be exposed to untrusted users or real financial data until auth, rate limiting, tenant isolation, and operational protections are implemented.
- The webhook is unauthenticated if WEBHOOK_SECRET is blank.
- OpenAI receives the uploaded document in live mode. Resend receives notification contents when enabled. Do not use sensitive real invoices in the public demo.
- Upload processing and reprocessing run synchronously, with a declared route duration cap of 120 seconds. Long-running workloads need a durable queue.
- No hosting provider, backup schedule, alerting system, or retention policy is configured by this repository.

## Cost considerations

Supabase database and Storage usage are shared with the other apps. OpenAI API extraction and hosting can add separate costs. Resend and hosted n8n may also require paid plans. Demo Mode avoids OpenAI extraction, but uploaded Demo Mode files still require Supabase to store them.

## Verification status

The worker test suite uses mocks and does not verify live Supabase, OpenAI, Resend, or n8n. The owner reported successful shared SQL execution and provided evidence of tables and bucket configuration. RLS role behavior and live app smoke tests remain unverified.
