# Shared Supabase implementation plan

## Requirements and local implementation
Use existing Northstar and preserve its data. Combine only SQL/setup artifacts;
keep table names and queries. User will Git push later. Inspected migrations,
database clients, query names, guestbook routes and setup. Prepared guarded
additive and empty bootstrap scripts, with identical copies in all three repos.

## Approval-gated deployment
1. Run inspect_destination.sql in the intended Supabase project's SQL Editor.
   Confirm actual Northstar schema/RLS and whether incoming app objects exist.
   Hosted state has not been inspected. If objects exist, stop and prepare a tailored
   migration after comparing definitions.
2. Back up the destination and any source records/files needing retention.
   If source apps have existing data, plan a separate approved data/file transfer.
3. Review and approve hosted execution of 002_add_to_existing_northstar.sql.
   Run once. Do not use the empty bootstrap on this destination.
4. After approval to change deployment settings, point Northstar/LedgerLens
   NEXT_PUBLIC_SUPABASE_URL and Niven SUPABASE_URL to the same project, with its
   SUPABASE_SERVICE_ROLE_KEY only on servers. Preserve current Demo Mode settings.
5. Smoke test with non-sensitive fixtures: Northstar submission persistence,
   Niven create/list/edit/moderation, LedgerLens private uploads and reads.
   Processing/notifications may invoke paid providers and need authorization.
   Review changes, then push each repo when authorized.

## Acceptance and verification
- Bootstrap defines nineteen distinct app tables; additive defines twelve.
- Northstar's existing objects and records preserved.
- All app tables have RLS; direct anon/authenticated CRUD denied, verified under
  actual roles before declaring deployed access controls correct.
- LedgerLens bucket is private and retains original size/MIME restrictions.
- Shared copies match; original migrations and application code unchanged.
- Local static counts/copy/diff checks performed and reported in chat.
  SQL parsing/execution, rollback, actual role access, hosted data preservation
  and application smoke tests remain pending without PostgreSQL/Supabase execution.

## Risks and unresolved facts
Hosted definitions may differ from repo definitions. Combined free-plan capacity
has not been assessed; no pricing/capacity guarantee. Backends share privileged
credentials and database resources. Live deployment and data imports are pending.
For a deployed failure, investigate/restore only affected new objects with backups;
do not drop the shared database or replay its bootstrap.