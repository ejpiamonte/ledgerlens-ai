# LedgerLens project guidance

## Project boundaries

- LedgerLens is a portfolio workflow demonstration for fictional invoice data, not a production accounting system.
- The shared Supabase project is also used by Northstar and Niven. Keep LedgerLens tables prefixed with ledgerlens_ and use the ledgerlens-invoice-documents bucket.
- Preserve the original app migrations as source history. The shared-project SQL scripts under supabase/shared are reviewed SQL Editor scripts, not a combined Supabase CLI migration history.
- Treat hosted schema, environment configuration, and provider availability as unverified unless current evidence is available. Record owner-reported verification separately from checks performed here.

## Security and data

- Never print, commit, or document credential values. Keep real values in ignored .env.local or an approved secret manager; .env.example must contain blank placeholders.
- All current API routes use a server-side Supabase service-role client and do not implement user authentication. Do not use this app with real financial documents or expose live mode publicly.
- Do not execute SQL against Supabase, change production settings, rotate keys, or transfer data without explicit approval. Review SQL and confirm the target project first.
- Treat OpenAI, Resend, and n8n as optional external services. Explain data sent to each service and possible usage charges before enabling live integrations.
- Never treat AI extraction as an approval. Deterministic rules and an operator decision own the invoice outcome.

## Engineering and documentation

- Inspect the current branch, working tree, affected code, and relevant docs before editing. Preserve existing history and user changes.
- Keep README.md as the setup and handover entry point. Keep detailed requirements, architecture, app flow, design, database, and implementation documentation under docs/.
- Update documentation when code, API behavior, database schema, integration, or deployment status changes. Distinguish implemented, tested, user-reported, proposed, and pending work.
- Run relevant lint, tests, type checks, builds, and consistency checks. Report what was actually run and any limitations.
- Do not commit or push unless requested. Never rewrite Git history without explicit approval.
