# LedgerLens AI

LedgerLens demonstrates invoice-document intake, AI-assisted field extraction, deterministic financial checks, and human review routing. It is a portfolio workflow using fictional sample data, not a production accounting system or a measured ROI claim.

## Try the demo in 2 minutes

Run the app (see setup below) with the default DEMO_MODE=true. No database or API keys are needed for the demo.

1. **Overview** (/) shows 30 days of accounts-payable activity: touchless rate, invoices waiting for review, why invoices needed a person, and an illustrative time and cost estimate you can edit.
2. Follow the **Start here** tour: a clean invoice that went straight through, a duplicate to catch before payment, and a large bill routed to the right approver.
3. In the **Review queue**, open any invoice, read why it was held and what to check, then approve or reject it. Your decisions appear in the audit trail and are kept only in your browser. Reset them under Rules & settings.
4. Switch **Small business / Enterprise** in the top bar to see the same engine run a different policy.
5. On **Documents**, search and filter, or upload your own PDF/PNG/JPG. In the demo the file is checked for real, fields are simulated, and the real rules decide. Nothing is stored.

Share a specific view with ?scenario=smb or ?scenario=enterprise, for example /review?scenario=enterprise.

## Small business and enterprise scenarios

| | Small business | Enterprise |
| --- | --- | --- |
| Company | Harbor & Pine Hospitality, two restaurants | Meridian Holdings, US, UK, and DE entities |
| Volume | about 120 invoices a month | about 2,400 a month (240-invoice sample shown) |
| Auto-approve | confidence 90%+ and all checks pass | confidence 92%+ and all checks pass |
| Approval threshold | $5,000, owner approves | $50,000; AP specialist, AP manager, controller by amount |
| PO matching | recurring services exempt | required, per entity |
| Review target | 48 hours | 24 hours |

Both use the same rules engine in lib/validation.ts. Scenario policies are in lib/scenarios.ts.

## What it demonstrates

- PDF, PNG, and JPEG validation and private document storage.
- A generated, deterministic demo workspace for two company sizes, evaluated by the real rules engine.
- Optional OpenAI extraction that proposes fields but does not decide approval.
- Deterministic arithmetic, date, required-field, currency, duplicate, purchase-order, confidence, suspicious-signal (for example a changed bank account), and high-value checks.
- Human review with approval levels, review targets, audit trail, run history, and optional notifications.
- Operational analytics: touchless rate, exception reasons, queue aging, vendor spend and exception rates.
- A shared-Supabase setup for LedgerLens alongside Northstar and Niven.

All companies, vendors, people, and invoices are fictional. Impact figures are illustrative estimates from editable assumptions, not measured results.

## Technology

Next.js 15, React 19, TypeScript, Supabase Postgres and Storage, Zod, OpenAI Responses API, optional Resend, and an optional n8n workflow export.

## Requirements and local setup

Use Node.js 20.9 or newer and npm.

1. Install dependencies with npm install.
2. Copy .env.example to .env.local.
3. Fill the Supabase URL and server-only service-role key from the intended project.
4. Keep DEMO_MODE=true for the initial connection check.
5. Run npm run dev and open http://localhost:3000.

The checked-in example file must contain placeholders only. Never commit .env.local, paste credentials into source, or use a service-role key in browser code. If a credential was previously committed, rotating it does not remove the old value from Git history.

## Supabase status and setup

The owner reports that the additive shared SQL ran successfully. Screenshots showed the LedgerLens tables and guestbook in the table list and confirmed the private bucket has a 10 MiB limit and PDF/PNG/JPEG allowlist. RLS behavior under anon/authenticated roles and a live application smoke test have not been independently verified.

Read docs/DATABASE_SCHEMA.md and docs/IMPLEMENTATION_PLAN.md before changing the shared database. For the existing Northstar project, the intended script is supabase/shared/002_add_to_existing_northstar.sql. Do not run the empty-database bootstrap or replay supabase/migrations/001_ledgerlens_init.sql on the already-shared database.

The README and schema documentation do not authorize production SQL execution. Back up the database before an approved schema change. Shared credentials are privileged across the project; table prefixes do not isolate them.

## Environment variables

- DEMO_MODE defaults to true. Exactly false enables live processing.
- NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY configure server-side Supabase access. Despite its name, this app reads the URL only in server code.
- OPENAI_API_KEY and OPENAI_MODEL configure live extraction. API usage may be billable separately from a ChatGPT plan.
- WEBHOOK_SECRET is optional. If it is blank, the document webhook does not enforce bearer authentication.
- RESEND_API_KEY, EMAIL_FROM, and REVIEW_EMAIL_TO jointly enable email delivery.
- N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET only configure the optional Settings status display; the app worker does not call n8n. The exported workflow must be imported, configured with its own LEDGERLENS_* and notification endpoint variables, and activated in n8n.

Store real values only in the local ignored .env.local or an approved secret manager. Do not put any values into this README, GitHub, screenshots, or issue reports.

## Test the project

- npm run lint
- npm run typecheck
- npm run test
- npm run build
- npm run format (Prettier) or npm run format:check

Tests also cover demo determinism, showcase outcomes, approval routing, and upload simulation. The worker test uses an in-memory Supabase-compatible test double and mocked OpenAI responses. It does not verify live Supabase, OpenAI, Resend, or n8n behavior.

## API

- POST /api/documents/upload accepts multipart field file. In Demo Mode it validates the file and returns a simulated decision without storing anything; in Live Mode it stores and processes synchronously.
- POST /api/webhook/document accepts base64 document data and can require a bearer secret.
- POST /api/documents/{id}/approve, /reject, and /reprocess operate on persisted records in Live Mode. In Demo Mode they record the visitor's decision in a cookie.
- POST /api/demo/reset clears the visitor's demo decisions (Demo Mode only).
- GET /api/health reports mode and whether the app can read the LedgerLens documents table.

The API routes currently have no end-user authentication. Do not expose Live Mode to the public or use real financial documents until authentication, authorization, tenant isolation, rate limiting, and operational controls are implemented.

## Optional integrations and cost

OpenAI extraction is optional and can incur API charges. Resend is optional email delivery. n8n is optional orchestration; local self-hosting may avoid an n8n Cloud subscription but still needs an always-on host for continuously available webhooks. Supabase database and storage usage are shared with the other apps. Free-tier availability and limits are not guaranteed here.

## Project documentation

- docs/PRD.md — purpose, scope, users, and success measures.
- docs/TRD.md — architecture, APIs, configuration, security, and operations.
- docs/APP_FLOW.md — intake, extraction, decision branches, retries, and review.
- docs/DESIGN_BRIEF.md — current UI direction and known usability/accessibility gaps.
- docs/DATABASE_SCHEMA.md — LedgerLens tables, shared Supabase context, and policy status.
- docs/IMPLEMENTATION_PLAN.md — status, security remediation, smoke tests, and remaining work.
- docs/ARCHITECTURE.md, docs/AUTOMATION.md, and docs/BUSINESS_RULES.md — focused technical references.
