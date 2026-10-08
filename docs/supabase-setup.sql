-- Calorie Tracker: Supabase schema for sync. Run once in the Supabase SQL Editor.
-- Design: docs/DESIGN.md section 7. One generic table holds every synced row, so the app can
-- change its local data model without server migrations.

create table if not exists public.records (
  -- Owner. Filled in automatically from the signed-in user.
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  entity            text        not null,           -- 'food', 'log_entry', 'meal', ...
  id                uuid        not null,           -- row id generated on the device
  data              jsonb       not null,           -- the row itself
  updated_at        bigint      not null,           -- device clock (ms); decides which edit wins
  deleted_at        bigint,                         -- soft delete, so deletions sync
  server_updated_at timestamptz not null default now(), -- set by trigger; devices pull by this
  primary key (user_id, entity, id)
);

create index if not exists records_pull_idx on public.records (user_id, server_updated_at);

-- Devices pull rows changed after a cursor. Using the server clock here means a phone with a
-- wrong clock cannot make its changes invisible to other devices.
create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

-- Only the trigger needs this function; it must not be callable through the API.
revoke execute on function public.set_server_updated_at() from public, anon, authenticated;

drop trigger if exists records_set_server_updated_at on public.records;
create trigger records_set_server_updated_at
  before insert or update on public.records
  for each row execute function public.set_server_updated_at();

-- Row level security: a signed-in user can only touch their own rows. Nobody else, including the
-- public (anon) key without a login, can read or write anything.
alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;

create policy "records_select_own" on public.records
  for select to authenticated using (user_id = (select auth.uid()));
create policy "records_insert_own" on public.records
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "records_update_own" on public.records
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "records_delete_own" on public.records
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;

-- Push a batch of rows. A row only overwrites the stored one when its updated_at is newer
-- (last write wins). Runs with the caller's rights, so row level security still applies.
-- rows: [{ "entity": "food", "id": "<uuid>", "data": {...}, "updated_at": 1730000000000, "deleted_at": null }, ...]
create or replace function public.push_records(rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  written integer;
begin
  insert into public.records as r (entity, id, data, updated_at, deleted_at)
  select x->>'entity',
         (x->>'id')::uuid,
         x->'data',
         (x->>'updated_at')::bigint,
         (x->>'deleted_at')::bigint
  from jsonb_array_elements(rows) as x
  on conflict (user_id, entity, id) do update
    set data       = excluded.data,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    where r.updated_at < excluded.updated_at;
  get diagnostics written = row_count;
  return written;
end;
$$;

revoke execute on function public.push_records(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;
