-- Calorie Tracker: hardening for a project that already ran an earlier supabase-setup.sql.
-- Safe to run more than once. New projects get the same changes from supabase-setup.sql.

-- The trigger function got a fixed search_path and is no longer callable through the API.
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

revoke execute on function public.set_server_updated_at() from public, anon, authenticated;
