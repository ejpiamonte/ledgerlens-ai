-- Shared Supabase SQL prepared 2026-10-13. Review before applying.
-- Does not import existing records, uploaded files or auth users.
-- EMPTY destination only; never run on installed Northstar.
begin;
do $preflight$
declare t text;
begin
  foreach t in array array['app_settings','salespeople','leads','automation_runs','lead_activities','appointments','email_logs','ledgerlens_documents','ledgerlens_vendors','ledgerlens_purchase_orders','ledgerlens_invoices','ledgerlens_invoice_line_items','ledgerlens_validation_results','ledgerlens_automation_runs','ledgerlens_review_queue','ledgerlens_audit_logs','ledgerlens_notifications','ledgerlens_app_settings','guestbook'] loop
    if to_regclass('public.' || t) is not null then
      raise exception 'Existing public.% detected. Compare its schema before migrating; existing app data is not imported.', t;
    end if;
  end loop;
  if exists (select 1 from storage.buckets where id = 'ledgerlens-invoice-documents') then
    raise exception 'Existing LedgerLens bucket detected. Review before applying.';
  end if;
end;
$preflight$;
do $preflight$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    raise exception 'Existing set_updated_at function detected. Review before applying.';
  end if;
end;
$preflight$;
-- northstar-ai-lead-management\migrations\001_northstar_init.sql
-- =====================================================================
-- Northstar AI Lead Management System
-- Migration 001: schema, indexes, triggers, RLS lockdown, seed reps
-- Run in the Supabase SQL editor or via `supabase db push`.
-- =====================================================================


create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- app_settings: key/value store (holds the Demo Mode toggle)
-- ---------------------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- salespeople
-- ---------------------------------------------------------------------
create table public.salespeople (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  email           text        not null unique,
  role_title      text        not null,
  specialty       text        not null check (specialty in ('ai_automation', 'web_app', 'support')),
  tier_focus      text        not null check (tier_focus in ('high', 'mid', 'low')),
  max_open_leads  integer     not null default 12 check (max_open_leads > 0),
  calendar_url    text,
  timezone        text        not null default 'UTC',
  active          boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_salespeople_active_tier on public.salespeople (active, tier_focus);

create trigger trg_salespeople_updated_at
  before update on public.salespeople
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------
create table public.leads (
  id               uuid        primary key default gen_random_uuid(),
  full_name        text        not null,
  email            text        not null,
  company          text,
  phone            text,
  service_interest text,
  budget_range     text,
  timeline         text,
  message          text        not null,
  source           text        not null default 'website_form',
  status           text        not null default 'new'
                   check (status in ('new', 'analyzing', 'assigned', 'contacted',
                                     'qualified', 'appointment_set', 'won', 'lost')),
  tier             text        check (tier in ('high', 'mid', 'low')),
  score            integer     check (score between 0 and 100),
  ai_analysis      jsonb,
  assigned_to      uuid        references public.salespeople (id) on delete set null,
  assigned_at      timestamptz,
  is_demo          boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_leads_email          on public.leads (lower(email));
create index idx_leads_status         on public.leads (status);
create index idx_leads_tier           on public.leads (tier);
create index idx_leads_assigned_to    on public.leads (assigned_to) where assigned_to is not null;
create index idx_leads_created_at     on public.leads (created_at desc);
create index idx_leads_is_demo        on public.leads (is_demo);
create index idx_leads_ai_analysis    on public.leads using gin (ai_analysis jsonb_path_ops);

create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- automation_runs: one row per webhook execution, steps stored as jsonb
-- ---------------------------------------------------------------------
create table public.automation_runs (
  id            uuid        primary key default gen_random_uuid(),
  lead_id       uuid        references public.leads (id) on delete cascade,
  trigger       text        not null default 'webhook',
  mode          text        not null default 'demo' check (mode in ('demo', 'live')),
  status        text        not null default 'running'
                check (status in ('running', 'success', 'partial', 'failed')),
  ai_provider   text,
  model         text,
  steps         jsonb       not null default '[]'::jsonb,
  duration_ms   integer,
  error         text,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_automation_runs_lead_id     on public.automation_runs (lead_id);
create index idx_automation_runs_status_time on public.automation_runs (status, started_at desc);

-- ---------------------------------------------------------------------
-- lead_activities: human-readable timeline per lead
-- ---------------------------------------------------------------------
create table public.lead_activities (
  id                 uuid        primary key default gen_random_uuid(),
  lead_id            uuid        not null references public.leads (id) on delete cascade,
  salesperson_id     uuid        references public.salespeople (id) on delete set null,
  automation_run_id  uuid        references public.automation_runs (id) on delete set null,
  activity_type      text        not null,
  title              text        not null,
  description        text,
  metadata           jsonb       not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create index idx_lead_activities_lead_time on public.lead_activities (lead_id, created_at desc);
create index idx_lead_activities_run       on public.lead_activities (automation_run_id) where automation_run_id is not null;
create index idx_lead_activities_type      on public.lead_activities (activity_type);

-- ---------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------
create table public.appointments (
  id                uuid        primary key default gen_random_uuid(),
  lead_id           uuid        not null references public.leads (id) on delete cascade,
  salesperson_id    uuid        not null references public.salespeople (id) on delete restrict,
  scheduled_at      timestamptz not null,
  duration_minutes  integer     not null default 30 check (duration_minutes between 5 and 480),
  status            text        not null default 'proposed'
                    check (status in ('proposed', 'confirmed', 'completed', 'cancelled', 'no_show')),
  meeting_url       text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_appointments_lead         on public.appointments (lead_id);
create index idx_appointments_rep_schedule on public.appointments (salesperson_id, scheduled_at);
create index idx_appointments_status_time  on public.appointments (status, scheduled_at);

create trigger trg_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- email_logs
-- ---------------------------------------------------------------------
create table public.email_logs (
  id                 uuid        primary key default gen_random_uuid(),
  lead_id            uuid        references public.leads (id) on delete cascade,
  salesperson_id     uuid        references public.salespeople (id) on delete set null,
  automation_run_id  uuid        references public.automation_runs (id) on delete set null,
  email_type         text        not null check (email_type in ('lead_acknowledgment', 'rep_notification', 'follow_up')),
  direction          text        not null default 'outbound' check (direction in ('outbound', 'internal')),
  to_email           text        not null,
  from_email         text        not null,
  subject            text        not null,
  body               text        not null,
  status             text        not null default 'queued'
                     check (status in ('queued', 'mocked', 'sent', 'failed')),
  provider           text,
  provider_message_id text,
  is_mock            boolean     not null default true,
  error              text,
  sent_at            timestamptz,
  created_at         timestamptz not null default now()
);

create index idx_email_logs_lead      on public.email_logs (lead_id, created_at desc);
create index idx_email_logs_run       on public.email_logs (automation_run_id) where automation_run_id is not null;
create index idx_email_logs_status    on public.email_logs (status);

-- ---------------------------------------------------------------------
-- Row Level Security: deny all by default.
-- The app talks to Supabase from the server with the service-role key,
-- which bypasses RLS. Add explicit policies before exposing any table
-- to the anon or authenticated roles.
-- ---------------------------------------------------------------------
alter table public.app_settings     enable row level security;
alter table public.salespeople      enable row level security;
alter table public.leads            enable row level security;
alter table public.automation_runs  enable row level security;
alter table public.lead_activities  enable row level security;
alter table public.appointments     enable row level security;
alter table public.email_logs       enable row level security;

-- ---------------------------------------------------------------------
-- Seed: settings and the three fictional salespeople
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value)
values ('demo_mode', '{"enabled": true}'::jsonb)
on conflict (key) do nothing;

insert into public.salespeople
  (id, name, email, role_title, specialty, tier_focus, max_open_leads, calendar_url, timezone)
values
  ('5a000000-0000-4000-8000-000000000001',
   'Sarah Whitfield', 'sarah@northstardigital.example',
   'Principal AI Automation Lead', 'ai_automation', 'high', 8,
   'https://cal.northstardigital.example/sarah', 'America/Los_Angeles'),
  ('5a000000-0000-4000-8000-000000000002',
   'Alex Moreno', 'alex@northstardigital.example',
   'Senior Web App Consultant', 'web_app', 'mid', 12,
   'https://cal.northstardigital.example/alex', 'America/New_York'),
  ('5a000000-0000-4000-8000-000000000003',
   'Maria Santos', 'maria@northstardigital.example',
   'Client Success and Support Lead', 'support', 'low', 20,
   'https://cal.northstardigital.example/maria', 'Europe/London')
on conflict (email) do nothing;


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
