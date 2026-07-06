-- Repair stale or missing household invite codes and let owners rotate them safely.

begin;

create or replace function public.ensure_household_invite_code(
  p_household_id uuid,
  p_rotate boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select owner_id
  into v_owner_id
  from public.households
  where id = p_household_id;

  if v_owner_id is null then
    raise exception 'Household not found';
  end if;

  if v_owner_id <> auth.uid() then
    raise exception 'Only the household owner can manage invite codes';
  end if;

  if p_rotate then
    update public.household_join_codes
    set active = false
    where household_id = p_household_id
      and active;
  else
    select code
    into v_code
    from public.household_join_codes
    where household_id = p_household_id
      and active
      and (expires_at is null or expires_at > now())
      and (max_uses is null or use_count < max_uses)
    order by created_at desc
    limit 1;
  end if;

  if v_code is null then
    loop
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      exit when not exists (
        select 1
        from public.household_join_codes
        where regexp_replace(upper(code), '[^A-Z0-9]', '', 'g') = v_code
      );
    end loop;

    insert into public.household_join_codes (
      household_id,
      code,
      created_by,
      active,
      use_count,
      max_uses,
      expires_at
    ) values (
      p_household_id,
      v_code,
      auth.uid(),
      true,
      0,
      null,
      null
    );
  end if;

  return v_code;
end;
$$;

-- Give any existing household without a usable active code a fresh one.
do $$
declare
  v_house record;
  v_code text;
begin
  for v_house in
    select h.id, h.owner_id
    from public.households h
    where not exists (
      select 1
      from public.household_join_codes c
      where c.household_id = h.id
        and c.active
        and (c.expires_at is null or c.expires_at > now())
        and (c.max_uses is null or c.use_count < c.max_uses)
    )
  loop
    loop
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      exit when not exists (
        select 1
        from public.household_join_codes
        where regexp_replace(upper(code), '[^A-Z0-9]', '', 'g') = v_code
      );
    end loop;

    insert into public.household_join_codes (
      household_id,
      code,
      created_by,
      active,
      use_count,
      max_uses,
      expires_at
    ) values (
      v_house.id,
      v_code,
      v_house.owner_id,
      true,
      0,
      null,
      null
    );
  end loop;
end;
$$;

create or replace function public.join_house(p_code text)
returns table (household_id uuid, household_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.household_join_codes%rowtype;
  v_name text;
  v_inserted integer := 0;
  v_clean_code text := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if char_length(v_clean_code) < 4 then
    raise exception 'Enter the full household invite code';
  end if;

  select *
  into v_code
  from public.household_join_codes
  where regexp_replace(upper(code), '[^A-Z0-9]', '', 'g') = v_clean_code
  order by active desc, created_at desc
  limit 1
  for update;

  if not found or not v_code.active then
    raise exception 'That invite code is not active';
  end if;

  if v_code.expires_at is not null and v_code.expires_at <= now() then
    raise exception 'That invite code has expired';
  end if;

  if v_code.max_uses is not null and v_code.use_count >= v_code.max_uses then
    raise exception 'That invite code has reached its limit';
  end if;

  select name
  into v_name
  from public.households
  where id = v_code.household_id;

  if v_name is null then
    raise exception 'The household linked to that invite no longer exists';
  end if;

  if not exists (
    select 1
    from public.household_members
    where household_id = v_code.household_id
      and user_id = auth.uid()
  ) and (
    select count(*)
    from public.household_members
    where household_id = v_code.household_id
  ) >= 10 then
    raise exception 'This household already has the maximum of 10 members';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_code.household_id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.household_join_codes
    set use_count = use_count + 1
    where id = v_code.id;
  end if;

  return query select v_code.household_id, v_name;
end;
$$;

revoke all on function public.ensure_household_invite_code(uuid, boolean) from public;
revoke all on function public.join_house(text) from public;

grant execute on function public.ensure_household_invite_code(uuid, boolean) to authenticated;
grant execute on function public.join_house(text) to authenticated;

commit;
