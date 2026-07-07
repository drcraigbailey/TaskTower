begin;

alter table public.household_shopping_items
  drop constraint if exists household_shopping_items_state_check;

alter table public.household_shopping_items
  add constraint household_shopping_items_state_check
  check (state in ('in_stock', 'low', 'out', 'list'));

create or replace function public.sync_low_stock_to_shopping_list()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.state not in ('low', 'out') or new.purchased_at is not null then
    return new;
  end if;

  insert into public.household_shopping_items (
    household_id,
    name,
    detail,
    category,
    state,
    created_by
  )
  select
    new.household_id,
    new.name,
    case
      when nullif(trim(new.detail), '') is not null then new.detail
      when new.state = 'out' then 'Auto-added because this is out'
      else 'Auto-added because this is running low'
    end,
    new.category,
    'list',
    coalesce(auth.uid(), new.created_by)
  where not exists (
    select 1
    from public.household_shopping_items existing
    where existing.household_id = new.household_id
      and existing.state = 'list'
      and existing.purchased_at is null
      and lower(trim(existing.name)) = lower(trim(new.name))
      and lower(trim(existing.category)) = lower(trim(new.category))
  );

  return new;
end;
$$;

drop trigger if exists household_shopping_low_stock_to_list
  on public.household_shopping_items;

create trigger household_shopping_low_stock_to_list
after insert or update of state
on public.household_shopping_items
for each row
execute function public.sync_low_stock_to_shopping_list();

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'due_soon',
      'overdue',
      'full_clean',
      'chore_completed',
      'member_joined',
      'member_left',
      'monthly_winner',
      'shopping_broadcast',
      'task_reminder',
      'system'
    )
  );

create or replace function public.broadcast_household_notification(
  p_household_id uuid,
  p_type text,
  p_title text,
  p_body text default '',
  p_data jsonb default '{}'::jsonb,
  p_include_sender boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_household_member(p_household_id, auth.uid()) then
    raise exception 'Not a member of this household';
  end if;

  if p_type not in (
    'due_soon',
    'overdue',
    'full_clean',
    'chore_completed',
    'member_joined',
    'member_left',
    'monthly_winner',
    'shopping_broadcast',
    'task_reminder',
    'system'
  ) then
    raise exception 'Unsupported notification type';
  end if;

  insert into public.notifications (user_id, household_id, type, title, body, data)
  select
    hm.user_id,
    p_household_id,
    p_type,
    trim(p_title),
    coalesce(p_body, ''),
    coalesce(p_data, '{}'::jsonb)
      || jsonb_build_object(
        'household_id', p_household_id,
        'sent_by', auth.uid()
      )
  from public.household_members hm
  where hm.household_id = p_household_id
    and (p_include_sender or hm.user_id <> auth.uid());

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.broadcast_household_notification(uuid, text, text, text, jsonb, boolean) from public;
grant execute on function public.broadcast_household_notification(uuid, text, text, text, jsonb, boolean) to authenticated;

commit;
