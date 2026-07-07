create or replace function public.join_house(p_code text)
returns table (
  household_id uuid,
  household_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.household_join_codes%rowtype;
  v_name text;
  v_inserted integer := 0;
  v_clean_code text :=
    regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if char_length(v_clean_code) < 4 then
    raise exception 'Enter the full household invite code';
  end if;

  select hjc.*
  into v_code
  from public.household_join_codes hjc
  where regexp_replace(upper(hjc.code), '[^A-Z0-9]', '', 'g') = v_clean_code
  order by hjc.active desc, hjc.created_at desc
  limit 1
  for update;

  if not found or not v_code.active then
    raise exception 'That invite code is not active';
  end if;

  if v_code.expires_at is not null
     and v_code.expires_at <= now() then
    raise exception 'That invite code has expired';
  end if;

  if v_code.max_uses is not null
     and v_code.use_count >= v_code.max_uses then
    raise exception 'That invite code has reached its limit';
  end if;

  select h.name
  into v_name
  from public.households h
  where h.id = v_code.household_id;

  if v_name is null then
    raise exception 'The household linked to that invite no longer exists';
  end if;

  if not exists (
    select 1
    from public.household_members hm
    where hm.household_id = v_code.household_id
      and hm.user_id = auth.uid()
  ) and (
    select count(*)
    from public.household_members hm
    where hm.household_id = v_code.household_id
  ) >= 10 then
    raise exception 'This household already has the maximum of 10 members';
  end if;

  insert into public.household_members (
    household_id,
    user_id,
    role
  )
  values (
    v_code.household_id,
    auth.uid(),
    'member'
  )
  on conflict (household_id, user_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.household_join_codes hjc
    set use_count = hjc.use_count + 1
    where hjc.id = v_code.id;
  end if;

  return query
  select
    v_code.household_id,
    v_name;
end;
$$;

revoke all on function public.join_house(text) from public;
grant execute on function public.join_house(text) to authenticated;