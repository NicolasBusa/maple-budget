-- Schema snapshot for provisioning a NEW Maple project. Do not rerun over existing tables.
create table public.maple_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null,
 version bigint not null default 1,
 updated_at timestamptz not null default now(),
 constraint valid_data check (jsonb_typeof(data)='object' and jsonb_typeof(data->'trip')='object' and jsonb_typeof(data->'categories')='array' and jsonb_typeof(data->'expenses')='array' and octet_length(data::text)<2000000)
);
alter table public.maple_accounts enable row level security;
revoke all on public.maple_accounts from anon;
grant select,insert,update on public.maple_accounts to authenticated;
create policy own_data_read on public.maple_accounts for select to authenticated using ((select auth.uid())=user_id);
create policy own_data_create on public.maple_accounts for insert to authenticated with check ((select auth.uid())=user_id);
create policy own_data_update on public.maple_accounts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create function public.save_maple_state(payload jsonb, expected_version bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if expected_version=0 then
   insert into public.maple_accounts(user_id,data) values(auth.uid(),payload)
   on conflict(user_id) do nothing returning jsonb_build_object('version',version,'updated_at',updated_at) into result;
 else
   update public.maple_accounts set data=payload,version=version+1,updated_at=now()
   where user_id=auth.uid() and version=expected_version
   returning jsonb_build_object('version',version,'updated_at',updated_at) into result;
 end if;
 if result is null then raise exception 'SYNC_CONFLICT'; end if;
 return result;
end; $$;
revoke all on function public.save_maple_state(jsonb,bigint) from public,anon;
grant execute on function public.save_maple_state(jsonb,bigint) to authenticated;
