-- Shared Supabase SQL prepared 2026-10-13. Review before applying.
-- Does not import existing records, uploaded files or auth users.
-- Existing Northstar only: its objects remain untouched.
begin;
do $preflight$
declare t text;
begin
  foreach t in array array['app_settings','salespeople','leads','automation_runs','lead_activities','appointments','email_logs'] loop
    if to_regclass('public.' || t) is null then
      raise exception 'Required Northstar table public.% missing. Confirm destination.', t;
    end if;
  end loop;
end;
$preflight$;
do $preflight$
declare t text;
begin
  foreach t in array array['ledgerlens_documents','ledgerlens_vendors','ledgerlens_purchase_orders','ledgerlens_invoices','ledgerlens_invoice_line_items','ledgerlens_validation_results','ledgerlens_automation_runs','ledgerlens_review_queue','ledgerlens_audit_logs','ledgerlens_notifications','ledgerlens_app_settings','guestbook'] loop
    if to_regclass('public.' || t) is not null then
      raise exception 'Existing public.% detected. Compare its schema before migrating; existing app data is not imported.', t;
    end if;
  end loop;
  if exists (select 1 from storage.buckets where id = 'ledgerlens-invoice-documents') then
    raise exception 'Existing LedgerLens bucket detected. Review before applying.';
  end if;
end;
$preflight$;
-- Safe to apply after Northstar: all LedgerLens public objects and its private Storage bucket are namespaced.
create extension if not exists pgcrypto;
create table if not exists public.ledgerlens_documents(id uuid primary key default gen_random_uuid(),filename text not null,original_filename text not null,file_type text not null,file_size bigint not null check(file_size between 1 and 10485760),storage_path text not null unique,source text not null default 'upload',status text not null default 'received',processing_status text not null default 'queued',review_status text not null default 'not_required',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.ledgerlens_vendors(id uuid primary key default gen_random_uuid(),name text not null,normalized_name text not null unique,email text,tax_id text,default_currency text not null default 'USD',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.ledgerlens_purchase_orders(id uuid primary key default gen_random_uuid(),po_number text not null unique,vendor_id uuid references public.ledgerlens_vendors(id),status text not null default 'open',approved_amount numeric(14,2),currency text not null default 'USD',created_at timestamptz not null default now());
create table if not exists public.ledgerlens_invoices(id uuid primary key default gen_random_uuid(),document_id uuid not null unique references public.ledgerlens_documents(id) on delete cascade,vendor_id uuid references public.ledgerlens_vendors(id),invoice_number text,invoice_date date,due_date date,po_number text,currency text,subtotal numeric(14,2),tax numeric(14,2),total numeric(14,2),confidence numeric(4,3) check(confidence between 0 and 1),extraction_status text not null default 'pending',approval_status text not null default 'pending',risk_level text not null default 'medium',raw_extraction jsonb,normalized_data jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.ledgerlens_invoice_line_items(id uuid primary key default gen_random_uuid(),invoice_id uuid not null references public.ledgerlens_invoices(id) on delete cascade,description text not null,quantity numeric(14,3),unit_price numeric(14,2),amount numeric(14,2),confidence numeric(4,3));
create table if not exists public.ledgerlens_validation_results(id uuid primary key default gen_random_uuid(),invoice_id uuid not null references public.ledgerlens_invoices(id) on delete cascade,validation_type text not null,status text not null,severity text not null,expected_value jsonb,actual_value jsonb,message text not null,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create table if not exists public.ledgerlens_automation_runs(id uuid primary key default gen_random_uuid(),document_id uuid not null references public.ledgerlens_documents(id) on delete cascade,invoice_id uuid references public.ledgerlens_invoices(id) on delete set null,trigger text not null,mode text not null,status text not null,ai_provider text,model text,duration_ms integer,error text,started_at timestamptz not null default now(),completed_at timestamptz,steps jsonb not null default '[]');
create table if not exists public.ledgerlens_review_queue(id uuid primary key default gen_random_uuid(),document_id uuid not null unique references public.ledgerlens_documents(id) on delete cascade,invoice_id uuid references public.ledgerlens_invoices(id) on delete cascade,reason text not null,priority text not null default 'normal',status text not null default 'pending',assigned_to text,reviewed_by text,reviewed_at timestamptz,notes text,created_at timestamptz not null default now());
create table if not exists public.ledgerlens_audit_logs(id uuid primary key default gen_random_uuid(),document_id uuid references public.ledgerlens_documents(id) on delete set null,invoice_id uuid references public.ledgerlens_invoices(id) on delete set null,action text not null,actor_type text not null,actor_name text,description text not null,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create table if not exists public.ledgerlens_notifications(id uuid primary key default gen_random_uuid(),document_id uuid references public.ledgerlens_documents(id) on delete set null,invoice_id uuid references public.ledgerlens_invoices(id) on delete set null,recipient text,notification_type text not null,subject text not null,body text not null,status text not null default 'pending',provider text,is_mock boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.ledgerlens_app_settings(key text primary key,value jsonb not null,updated_at timestamptz not null default now());
insert into public.ledgerlens_app_settings(key,value) values('demo_mode','true'::jsonb),('arithmetic_tolerance','0.02'::jsonb),('duplicate_tolerance','0.02'::jsonb),('high_value_threshold','25000'::jsonb),('auto_process_confidence','0.90'::jsonb),('review_confidence_threshold','0.70'::jsonb) on conflict(key) do nothing;
insert into public.ledgerlens_purchase_orders(po_number,status,approved_amount,currency) values('PO-1001','open',10000,'USD'),('PO-1002','open',10000,'USD'),('PO-1003','open',100000,'USD'),('PO-1004','open',10000,'USD') on conflict(po_number) do nothing;
create index if not exists ledgerlens_documents_status_created_idx on public.ledgerlens_documents(status,created_at desc);create index if not exists ledgerlens_invoices_vendor_number_idx on public.ledgerlens_invoices(vendor_id,invoice_number);create index if not exists ledgerlens_invoices_total_idx on public.ledgerlens_invoices(total);create index if not exists ledgerlens_validation_invoice_idx on public.ledgerlens_validation_results(invoice_id,created_at);create index if not exists ledgerlens_runs_document_idx on public.ledgerlens_automation_runs(document_id,started_at desc);create index if not exists ledgerlens_review_pending_idx on public.ledgerlens_review_queue(status,priority,created_at);create index if not exists ledgerlens_audits_document_idx on public.ledgerlens_audit_logs(document_id,created_at desc);
create unique index if not exists ledgerlens_review_queue_document_unique on public.ledgerlens_review_queue(document_id);
do $$ declare t text; begin foreach t in array array['ledgerlens_documents','ledgerlens_vendors','ledgerlens_purchase_orders','ledgerlens_invoices','ledgerlens_invoice_line_items','ledgerlens_validation_results','ledgerlens_automation_runs','ledgerlens_review_queue','ledgerlens_audit_logs','ledgerlens_notifications','ledgerlens_app_settings'] loop execute format('alter table public.%I enable row level security',t); execute format('drop policy if exists deny_client_access on public.%I',t); execute format('create policy deny_client_access on public.%I for all to anon, authenticated using (false) with check (false)',t); end loop; end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ledgerlens-invoice-documents','ledgerlens-invoice-documents',false,10485760,array['application/pdf','image/png','image/jpeg']) on conflict(id) do nothing;

-- Niven definition from SETUP.md, confirmed against guestbook/admin routes.
create table public.guestbook (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  message text not null,
  edit_token uuid not null default gen_random_uuid(),
  approved boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.guestbook enable row level security;
revoke all on table public.guestbook from anon, authenticated;
grant select, insert, update, delete on table public.guestbook to service_role;
-- Server routes use service_role. No direct client access is required.
commit;
