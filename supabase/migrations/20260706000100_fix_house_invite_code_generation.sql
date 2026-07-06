-- Fix create_house failing to resolve gen_random_bytes inside its restricted search_path.
-- Generate the eight-character invite code from PostgreSQL's UUID generator instead.

begin;

create or replace function public.create_house(p_name text)
returns table (household_id uuid, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(p_name)) < 2 then
    raise exception 'House name is too short';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1
      from public.household_join_codes
      where code = v_code
    );
  end loop;

  insert into public.households (name, owner_id)
  values (trim(p_name), auth.uid())
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_household_id, auth.uid(), 'owner');

  insert into public.chore_settings (household_id)
  values (v_household_id);

  insert into public.household_join_codes (household_id, code, created_by)
  values (v_household_id, v_code, auth.uid());

  return query select v_household_id, v_code;
end;
$$;

revoke all on function public.create_house(text) from public;
grant execute on function public.create_house(text) to authenticated;

commit;
