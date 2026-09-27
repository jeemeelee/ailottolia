begin;
create table if not exists public.site_visitors (
 visitor_id uuid primary key,
 first_seen timestamptz not null default now(),
 last_seen timestamptz not null default now(),
 country text not null default 'ZZ' check(country ~ '^[A-Z]{2}$')
);
create table if not exists public.site_daily (
 day date not null,
 visitor_id uuid not null references public.site_visitors(visitor_id),
 generations integer not null default 0 check(generations between 0 and 1000),
 primary key(day,visitor_id)
);
create table if not exists public.site_event_ids (
 event_id uuid primary key,
 created_at timestamptz not null default now()
);
alter table public.site_visitors enable row level security;
alter table public.site_daily enable row level security;
alter table public.site_event_ids enable row level security;
revoke all on public.site_visitors, public.site_daily, public.site_event_ids from public, anon, authenticated;
create or replace function public.record_site_event(p_visitor uuid,p_event uuid,p_kind text,p_country text default 'ZZ')
returns void language plpgsql security definer set search_path=''
as $$
declare d date := (now() at time zone 'Asia/Seoul')::date; inserted integer;
begin
 if p_visitor is null or p_event is null or p_kind is null or p_kind not in ('visit','generate') or p_country is null or p_country !~ '^[A-Z]{2}$' then
  raise exception 'Invalid event' using errcode='22023';
 end if;
 -- Serialize one browser's concurrent events, including reloads and retries.
 perform pg_advisory_xact_lock(hashtextextended(p_visitor::text,731));
 if p_kind='generate' then
  if coalesce((select generations from public.site_daily where day=d and visitor_id=p_visitor),0)>=1000 then return; end if;
  insert into public.site_event_ids(event_id) values(p_event) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted=0 then return; end if;
 end if;
 insert into public.site_visitors(visitor_id,country) values(p_visitor,p_country)
 on conflict(visitor_id) do update set last_seen=now(),country=case when site_visitors.country='ZZ' then excluded.country else site_visitors.country end;
 insert into public.site_daily(day,visitor_id,generations) values(d,p_visitor,case when p_kind='generate' then 1 else 0 end)
 on conflict(day,visitor_id) do update set generations=site_daily.generations+excluded.generations;
end;
$$;
revoke all on function public.record_site_event(uuid,uuid,text,text) from public;
grant execute on function public.record_site_event(uuid,uuid,text,text) to anon,authenticated;
create or replace function public.get_site_statistics()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare d date := (now() at time zone 'Asia/Seoul')::date; result jsonb;
begin
 if not public.is_prompt_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 select jsonb_build_object(
  'today',(select count(*) from public.site_daily where day=d),
  'week',(select count(distinct visitor_id) from public.site_daily where day>=date_trunc('week',d::timestamp)::date),
  'total',(select count(*) from public.site_visitors),
  'generations',(select coalesce(sum(generations),0) from public.site_daily),
  'countries',coalesce((select jsonb_object_agg(country,n) from (select country,count(*) n from public.site_visitors group by country)c),'{}'::jsonb),
  'started_at',(select min(first_seen) from public.site_visitors),
  'updated_at',now()
 ) into result;
 return result;
end;
$$;
revoke all on function public.get_site_statistics() from public,anon;
grant execute on function public.get_site_statistics() to authenticated;
commit;
