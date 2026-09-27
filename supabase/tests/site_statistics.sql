begin;
select set_config('request.jwt.claims',json_build_object('sub',(select user_id from public.prompt_admins limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare before jsonb; after jsonb; v uuid := gen_random_uuid(); e uuid := gen_random_uuid();
begin
 before := public.get_site_statistics();
 perform public.record_site_event(v,gen_random_uuid(),'visit','KR');
 perform public.record_site_event(v,gen_random_uuid(),'visit','KR');
 perform public.record_site_event(v,e,'generate','KR');
 perform public.record_site_event(v,e,'generate','KR');
 after := public.get_site_statistics();
 if (after->>'total')::bigint <> (before->>'total')::bigint+1 or
    (after->>'today')::bigint <> (before->>'today')::bigint+1 or
    (after->>'week')::bigint <> (before->>'week')::bigint+1 or
    (after->>'generations')::bigint <> (before->>'generations')::bigint+1 then raise exception 'FAIL: dedup or counters'; end if;
 if (after->'countries'->>'KR')::bigint <> coalesce((before->'countries'->>'KR')::bigint,0)+1 then raise exception 'FAIL: country'; end if;
 perform public.record_site_event(v,gen_random_uuid(),'generate','KR');
 after := public.get_site_statistics();
 if (after->>'generations')::bigint <> (before->>'generations')::bigint+2 then raise exception 'FAIL: separate generation'; end if;
 begin
  perform public.record_site_event(v,gen_random_uuid(),'bad','KR');
  raise exception 'FAIL: invalid event accepted';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin perform public.get_site_statistics(); raise exception 'FAIL: ordinary user can read statistics'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.get_site_statistics(); raise exception 'FAIL: anonymous statistics read'; exception when insufficient_privilege then null; end;
 begin perform count(*) from public.site_visitors; raise exception 'FAIL: raw visitor access'; exception when insufficient_privilege then null; end;
 begin insert into public.site_visitors(visitor_id) values(gen_random_uuid()); raise exception 'FAIL: direct write'; exception when insufficient_privilege then null; end;
 perform public.record_site_event(gen_random_uuid(),gen_random_uuid(),'visit','ZZ');
end $$;
reset role;
rollback;
select 'PASS: deduplication, counts, countries, admin-only reads, no direct writes' as statistics_tests;
