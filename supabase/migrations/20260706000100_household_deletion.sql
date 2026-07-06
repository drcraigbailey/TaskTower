-- Allow a household owner to permanently delete a household and its related data.

begin;

create or replace function public.delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_table text;
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
    raise exception 'Only the household owner can delete this household';
  end if;

  -- Delete known household-scoped rows explicitly. This keeps the RPC safe on
  -- older installations where one or more foreign keys may not yet cascade.
  foreach v_table in array array[
    'notifications',
    'household_activity',
    'chore_completions',
    'monthly_game_state',
    'shopping_items',
    'household_shopping_items',
    'household_messages',
    'household_notices',
    'chores',
    'chore_settings',
    'household_settings',
    'household_join_codes',
    'household_members'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('delete from public.%I where household_id = $1', v_table)
      using p_household_id;
    end if;
  end loop;

  delete from public.households
  where id = p_household_id;

  if not found then
    raise exception 'Household could not be deleted';
  end if;
end;
$$;

revoke all on function public.delete_household(uuid) from public;
grant execute on function public.delete_household(uuid) to authenticated;

commit;
