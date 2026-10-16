# Database schema and shared Supabase project

## Deployment status

The project owner reported that the additive SQL completed successfully. The supplied Supabase screenshots showed the LedgerLens tables and guestbook in public and confirmed the bucket is private with a 10 MiB limit and PDF/PNG/JPEG allowlist. We have not independently queried the hosted database. RLS policies and behavior under anon/authenticated roles still need direct verification.

The shared scripts are under supabase/shared. The chosen existing-project script is 002_add_to_existing_northstar.sql. The standalone app migration is retained as source history; do not replay it on the shared project. The empty bootstrap is only for an empty database.

## LedgerLens tables

All LedgerLens tables are in public and use the ledgerlens_ prefix. UUID primary keys use gen_random_uuid unless noted.

- ledgerlens_documents: id UUID PK; filename, original_filename, file_type, storage_path, source, status, processing_status, review_status as text; file_size bigint constrained to 1..10,485,760; storage_path unique; created_at and updated_at timestamptz defaults now().
- ledgerlens_vendors: id UUID PK; name and normalized_name required text; normalized_name unique; optional email and tax_id; default_currency required text default USD; created_at and updated_at timestamptz.
- ledgerlens_purchase_orders: id UUID PK; po_number required unique text; optional vendor_id references ledgerlens_vendors with default NO ACTION; status text default open; optional approved_amount numeric(14,2); currency text default USD; created_at timestamptz.
- ledgerlens_invoices: id UUID PK; document_id required unique FK to ledgerlens_documents with ON DELETE CASCADE; optional vendor_id FK to ledgerlens_vendors; invoice_number, invoice_date, due_date, po_number, currency; subtotal, tax, total numeric(14,2); confidence numeric(4,3) constrained to 0..1; extraction_status, approval_status, risk_level text; raw_extraction and normalized_data jsonb; created_at and updated_at.
- ledgerlens_invoice_line_items: id UUID PK; required invoice_id FK with ON DELETE CASCADE; description required text; quantity numeric(14,3); unit_price and amount numeric(14,2); confidence numeric(4,3).
- ledgerlens_validation_results: id UUID PK; required invoice_id FK with ON DELETE CASCADE; validation_type, status, severity, message required text; expected_value, actual_value, metadata jsonb; metadata defaults to an empty object; created_at timestamptz.
- ledgerlens_automation_runs: id UUID PK; required document_id FK with ON DELETE CASCADE; optional invoice_id FK with ON DELETE SET NULL; trigger, mode, status required text; optional ai_provider, model, duration_ms, error; steps jsonb defaults to an empty array; started_at defaults now(); optional completed_at; created_at defaults now().
- ledgerlens_review_queue: id UUID PK; document_id required unique FK with ON DELETE CASCADE; optional invoice_id FK with ON DELETE CASCADE; reason required text; priority defaults normal; status defaults pending; optional assigned_to, reviewed_by, reviewed_at, notes; created_at defaults now().
- ledgerlens_audit_logs: id UUID PK; optional document_id and invoice_id FKs each ON DELETE SET NULL; action, actor_type, description required text; optional actor_name; metadata jsonb defaults to an empty object; created_at defaults now().
- ledgerlens_notifications: id UUID PK; optional document_id and invoice_id FKs each ON DELETE SET NULL; optional recipient; notification_type and subject/body required text; status defaults pending; optional provider; is_mock boolean defaults true; created_at defaults now().
- ledgerlens_app_settings: key text PK; value jsonb required; updated_at defaults now(). Seeds arithmetic_tolerance 0.02, duplicate_tolerance 0.02, high_value_threshold 25000, auto_process_confidence 0.90, review_confidence_threshold 0.70, and demo_mode true.

## Indexes and relationships

Indexes support document status/time, invoice vendor/number and total, validation by invoice/time, runs by document/time, review status/priority/time, and audit entries by document/time. The review queue also has a unique document_id index; document_id is already declared unique in the table definition.

Invoices are one-to-one with documents. Line items and validations belong to an invoice. Runs, reviews, audits, and notifications link back to documents and optionally invoices. Vendor records are shared by invoices and purchase orders.

## Storage

Bucket ledgerlens-invoice-documents is private. Its reported configuration is 10,485,760 bytes maximum with application/pdf, image/png, and image/jpeg allowed. Object paths use document UUID plus sanitized filename. Preview links are signed server-side.

## Access policies

RLS is enabled for every LedgerLens table. The shared additive script installs a deny_client_access policy for anon and authenticated on LedgerLens tables. The app uses SUPABASE_SERVICE_ROLE_KEY server-side; service_role bypasses RLS. Table prefixes do not isolate the shared privileged key. Live policy behavior has not been independently tested under each role.

## Other apps in the shared project

- Northstar owns app_settings, salespeople, leads, automation_runs, lead_activities, appointments, and email_logs. The additive script requires these objects and does not alter them.
- The shared script also adds guestbook for the Niven app. It is not a LedgerLens-owned table.
- No existing rows, Storage objects, or auth users are copied by these scripts.

## SQL artifacts

- supabase/shared/inspect_destination.sql reads object, policy, and bucket metadata.
- supabase/shared/002_add_to_existing_northstar.sql is the additive script for the existing Northstar database. It checks expected table names and refuses conflicts; it does not compare every hosted column definition.
- supabase/shared/001_bootstrap_empty.sql is only for a verified empty destination.
- supabase/migrations/001_ledgerlens_init.sql is the original LedgerLens migration source, not the shared cross-project deployment history.
