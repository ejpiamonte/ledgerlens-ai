-- READ ONLY: object/policy/bucket metadata; no row data or credentials.
select n.nspname as schema_name, c.relname as object_name, c.relkind, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p','v','m')
order by c.relname;
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'ledgerlens-invoice-documents';