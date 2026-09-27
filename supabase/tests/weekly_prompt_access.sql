-- Execute as project database owner after enrolling the verified admin.
-- All mutations roll back. Any unexpected access raises an exception.
begin;
set local role anon;
select prompt, created_at from public.weekly_prompts where is_active = true;
do $$ begin
  begin
    update public.weekly_prompts set is_active = false where false;
    raise exception 'FAIL: anonymous direct update allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_weekly_prompt('무작위');
    raise exception 'FAIL: anonymous RPC allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if public.is_prompt_admin() then raise exception 'FAIL: non-admin recognized as admin'; end if;
  begin
    perform public.save_weekly_prompt('무작위');
    raise exception 'FAIL: ordinary user RPC allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.prompt_admins(user_id) values ('00000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: self-enrollment allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',(select user_id from public.prompt_admins limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
  if not public.is_prompt_admin() then raise exception 'FAIL: enroll a verified administrator first'; end if;
  perform public.save_weekly_prompt('홀수 3개 / 7 포함 / 1, 2 제외 / 연속번호 제외');
  if (select count(*) from public.weekly_prompts where is_active = true) <> 1 then raise exception 'FAIL: expected one active prompt'; end if;
  if not exists(select 1 from public.weekly_prompts where is_active = true and prompt='홀수 3개 / 7 포함 / 1, 2 제외 / 연속번호 제외') then raise exception 'FAIL: saved prompt missing'; end if;
end $$;
reset role;
rollback;
