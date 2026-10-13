# Shared Supabase database

Status: SQL prepared locally, not executed against Supabase.
Decision (2026-10-13): use the existing Northstar project and preserve its data.
Scope: SQL/setup only. Application queries and historical migrations are unchanged.

## Objects and sources
All app tables remain in public; names do not overlap.
Northstar owns seven tables: app_settings, salespeople, leads, automation_runs,
lead_activities, appointments, email_logs. Its original 001_northstar_init.sql
remains the exact definition of fields, relationships, checks, indexes and triggers.

LedgerLens owns eleven tables: ledgerlens_documents, ledgerlens_vendors,
ledgerlens_purchase_orders, ledgerlens_invoices, ledgerlens_invoice_line_items,
ledgerlens_validation_results, ledgerlens_automation_runs, ledgerlens_review_queue,
ledgerlens_audit_logs, ledgerlens_notifications, ledgerlens_app_settings.
Its original 001_ledgerlens_init.sql remains the exact field/relationship/index
definition. Its private ledgerlens-invoice-documents bucket allows PDF, PNG, JPEG
up to 10 MiB. Its settings and fictional purchase order seeds are preserved.

Niven owns guestbook: id (generated UUID primary key), name and message (required
text), edit_token (required generated UUID), approved (required boolean, default
true), created_at (required timestamptz, default now()). No foreign keys or extra
indexes added. Definition is from Niven SETUP.md, confirmed against API routes.
RSVP continues to use Google Forms/Sheets. Portfolio needs no database.

## Access
Northstar enables RLS with no client policies. LedgerLens enables RLS with false
anon/authenticated policies. The new guestbook enables RLS, revokes direct
anon/authenticated table privileges and grants CRUD to service_role. Niven's
existing server routes still publish approved messages and issue owner edit tokens.

All three backends use service-role credentials, which bypass RLS across the shared
project. This provides no isolation between compromised backends. Keep credentials
server-side and out of Git. Resources and project configuration are shared.
Reference: https://supabase.com/docs/guides/database/postgres/row-level-security

## Installation artifacts
- supabase/shared/inspect_destination.sql: read-only metadata inventory.
- supabase/shared/002_add_to_existing_northstar.sql: chosen path. Requires all seven
  Northstar table names; leaves its objects/data untouched. Refuses any existing
  incoming table or LedgerLens bucket, pending schema comparison. Adds twelve tables.
- supabase/shared/001_bootstrap_empty.sql: alternative full nineteen-table setup for
  an empty destination. Refuses conflicting table names, trigger function or bucket.

Installation scripts use a single transaction. Errors roll back their changes.
Preflight checks verify object names, not full hosted schema compatibility.
No existing records, uploaded files or auth users are transferred.
Do not replay the original Northstar migration on its installed database.

Shared scripts sit outside migrations/ for reviewed SQL Editor execution.
Do not db push the independent repositories into one migration history: their
original 001 versions overlap. Each shared folder is identical; update/compare all
three copies together. Original migrations and Niven SETUP.md remain source files.