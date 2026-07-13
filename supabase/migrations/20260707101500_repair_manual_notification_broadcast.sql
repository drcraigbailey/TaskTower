begin;

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
      'notice',
      'urgent_notice',
      'household_message',
      'direct_message',
      'shopping_low',
      'shopping_out',
      'shopping_assigned',
      'shopping_broadcast',
      'task_reminder',
      'invitation',
      'role_changed',
      'settings_changed',
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
    'notice',
    'urgent_notice',
    'household_message',
    'direct_message',
    'shopping_low',
    'shopping_out',
    'shopping_assigned',
    'shopping_broadcast',
    'task_reminder',
    'invitation',
    'role_changed',
    'settings_changed',
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

notify pgrst, 'reload schema';

commit;
