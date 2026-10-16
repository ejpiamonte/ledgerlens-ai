# Implementation and verification plan

## Completed

- LedgerLens portfolio workspace, deterministic fixture mode, upload and webhook routes, extraction adapter, validation rules, review actions, run/audit tracking, and optional notification adapters are implemented.
- Mocked worker lifecycle tests cover successful persistence, retries, review routing, malformed extraction output, and provider failure handling.
- Shared Supabase SQL and documentation were prepared for Northstar, LedgerLens, and Niven while preserving the existing Northstar objects.
- The project owner reported successful execution of the additive shared SQL. Supplied screenshots showed the LedgerLens tables, guestbook, and private bucket configuration.
- A public GitHub repository exists with the initial implementation and shared schema documentation.
- Portfolio polish (2026-10-17): readable source formatting with Prettier; small-business and enterprise demo scenarios on one rules engine; generated 30-day demo data; overview analytics (touchless rate, exception reasons, queue aging, vendor spend, illustrative impact estimate); guided tour and How it works page; grouped navigation with review count; working document filters and pagination; rendered invoice preview with field highlights; review queue with priority, approver level, and review-target status; Demo Mode review actions and upload simulation without Supabase. Tests added for demo determinism, showcase outcomes, approval routing, and upload simulation.

## Remaining phases

### Security remediation — required before live use

- A non-empty Supabase service-role value was found in tracked .env.example and in local Git history. Treat it as compromised and rotate/revoke it in Supabase before using the shared project from a live app.
- .env.example has been sanitized in the working tree. The sanitization has not been pushed yet; public GitHub content/history may still contain the exposed value.
- Follow Supabase's [API key guidance](https://supabase.com/docs/guides/getting-started/api-keys) and [legacy JWT rotation guidance](https://supabase.com/docs/guides/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd): create and deploy a replacement secret key, verify every backend, then deactivate the legacy key. Removing the value from a file alone does not revoke it.
- After rotation, decide whether to remove the secret-bearing commit from public Git history. Rewriting published history requires explicit approval and coordination with any clones.
- Verify that all current deployment/local secret settings use the rotated key; never transmit or record its value in chat.

### Configuration and smoke tests

- Verify NEXT_PUBLIC_SUPABASE_URL and the rotated service-role key are configured only in server-side environments.
- Run the read-only schema/policy/bucket inspection and verify RLS for LedgerLens and guestbook under the intended roles.
- With Demo Mode on, check /api/health and upload a synthetic file; verify a simulated decision is returned, nothing is written to Storage, and no OpenAI request occurs.
- After explicit cost approval, configure an OpenAI API key, switch Live Mode on, and process one synthetic document. Verify invoice, line item, validation, run, audit, review, and notification records.
- Exercise one clean invoice, one review case, invalid file, malformed extraction response, and a retry; confirm no real financial documents are used.

### Before production or external customers

- Add authentication, authorization, tenant isolation, webhook authentication, rate limiting, and server-side protections.
- Move synchronous extraction to a durable queue with retry/backoff, idempotency, observability, and operational recovery.
- Define backups, retention/deletion, incident response, monitoring, and paid-provider limits.
- Complete an accessibility review and deployment smoke test.

## Acceptance criteria

- No service credentials exist in working-tree example files or new commits.
- Owner confirms key rotation before Live Mode is used.
- Hosted table definitions and policies match the intended shared scripts; Northstar data remains intact.
- Health endpoint reports database available with Demo Mode still on.
- Synthetic live workflow passes all persistence and routing checks after Live Mode is deliberately enabled.
- Documentation, environment template, and public repository contain no credential values.

## Limits

Current tests use in-memory Supabase-compatible behavior and mocked OpenAI responses. They do not prove hosted SQL execution, actual role permissions, live provider behavior, backups, or production readiness. User-supplied screenshots confirm table names and bucket metadata only.
