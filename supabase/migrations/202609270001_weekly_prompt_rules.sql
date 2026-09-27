begin;
-- Existing rows are retained. This migration also supports a new project.
create table if not exists public.weekly_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Only a trusted database administrator can enroll an existing Auth user.
create table if not exists public.prompt_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.prompt_admins enable row level security;
revoke all on public.prompt_admins from public, anon, authenticated;

create or replace function public.is_prompt_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.prompt_admins where user_id = (select auth.uid())); $$;
revoke all on function public.is_prompt_admin() from public;
grant execute on function public.is_prompt_admin() to authenticated;

alter table public.weekly_prompts enable row level security;
-- Replace permissive legacy policies; policies are ORed by PostgreSQL.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='weekly_prompts'
  loop execute format('drop policy %I on public.weekly_prompts',p.policyname); end loop;
end $$;
revoke all on public.weekly_prompts from public, anon, authenticated;
grant select(prompt, is_active, created_at) on public.weekly_prompts to anon, authenticated;
create policy read_active_prompt on public.weekly_prompts for select to anon, authenticated using (is_active = true);
-- Direct writes are deliberately revoked. The RPC is the only client write path.
-- Its database-side allowlist check cannot be bypassed by editing browser code.
create or replace function public.save_weekly_prompt(new_prompt text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_prompt_admin() then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  if new_prompt is null or char_length(btrim(new_prompt)) < 1 or char_length(new_prompt) > 2000 then
    raise exception 'Prompt must contain 1 to 2000 characters' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(20260927, 1);
  update public.weekly_prompts set is_active=false where is_active=true;
  insert into public.weekly_prompts(prompt,is_active) values (btrim(new_prompt),true);
end;
$$;
revoke all on function public.save_weekly_prompt(text) from public, anon;
grant execute on function public.save_weekly_prompt(text) to authenticated;
commit;
