-- Enforce household permissions and recurring task timing at the database boundary.
-- Apply after 003_wire_household_features.sql.

begin;

create or replace function public.calculate_chore_next_due(
  p_frequency_type text,
  p_frequency_interval integer,
  p_frequency_unit text,
  p_from timestamptz
)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select case p_frequency_type
    when 'daily' then p_from + make_interval(days => greatest(coalesce(p_frequency_interval, 1), 1))
    when 'weekly' then p_from + make_interval(weeks => greatest(coalesce(p_frequency_interval, 1), 1))
    when 'fortnightly' then p_from + make_interval(weeks => greatest(coalesce(p_frequency_interval, 1), 1) * 2)
    when 'monthly' then p_from + make_interval(months => greatest(coalesce(p_frequency_interval, 1), 1))
    when 'custom_days' then p_from + make_interval(days => greatest(coalesce(p_frequency_interval, 1), 1))
    when 'custom_interval' then p_from + case p_frequency_unit
      when 'weeks' then make_interval(weeks => greatest(coalesce(p_frequency_interval, 1), 1))
      when 'months' then make_interval(months => greatest(coalesce(p_frequency_interval, 1), 1))
      else make_interval(days => greatest(coalesce(p_frequency_interval, 1), 1))
    end
    else p_from + interval '1 week'
  end;
$$;

create or replace function public.set_chore_next_due()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.next_due_at := public.calculate_chore_next_due(
      new.frequency_type,
      new.frequency_interval,
      new.frequency_unit,
      coalesce(new.last_completed_at, new.created_at, now())
    );
  elsif new.frequency_type is distinct from old.frequency_type
     or new.frequency_interval is distinct from old.frequency_interval
     or new.frequency_unit is distinct from old.frequency_unit
     or new.last_completed_at is distinct from old.last_completed_at then
    new.next_due_at := public.calculate_chore_next_due(
      new.frequency_type,
      new.frequency_interval,
      new.frequency_unit,
      coalesce(new.last_completed_at, new.created_at, now())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists chores_set_next_due on public.chores;
create trigger chores_set_next_due
before insert or update on public.chores
for each row execute function public.set_chore_next_due();

update public.chores
set next_due_at = public.calculate_chore_next_due(
  frequency_type,
  frequency_interval,
  frequency_unit,
  coalesce(last_completed_at, created_at, now())
)
where next_due_at is null;

create or replace function public.household_permission(
  p_household_id uuid,
  p_permission text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_household_admin(p_household_id, p_user_id)
    or (
      public.is_household_member(p_household_id, p_user_id)
      and coalesce(
        (
          select (s.permissions ->> p_permission)::boolean
          from public.household_settings s
          where s.household_id = p_household_id
        ),
        true
      )
    );
$$;

create or replace function public.household_feature_enabled(
  p_household_id uuid,
  p_feature text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case p_feature
        when 'messaging_enabled' then s.messaging_enabled
        when 'direct_messages_enabled' then s.direct_messages_enabled
        when 'notices_enabled' then s.notices_enabled
        else false
      end
      from public.household_settings s
      where s.household_id = p_household_id
    ),
    true
  );
$$;

revoke all on function public.household_permission(uuid, text, uuid) from public;
revoke all on function public.household_feature_enabled(uuid, text) from public;
grant execute on function public.household_permission(uuid, text, uuid) to authenticated;
grant execute on function public.household_feature_enabled(uuid, text) to authenticated;

-- Tasks.
drop policy if exists "members create chores" on public.chores;
drop policy if exists "members update chores" on public.chores;
drop policy if exists "members delete chores" on public.chores;

create policy "permitted members create chores"
on public.chores for insert to authenticated
with check (
  created_by = auth.uid()
  and public.household_permission(household_id, 'members_add_tasks')
);

create policy "permitted members update chores"
on public.chores for update to authenticated
using (public.household_permission(household_id, 'members_add_tasks'))
with check (public.household_permission(household_id, 'members_add_tasks'));

create policy "permitted members delete chores"
on public.chores for delete to authenticated
using (public.household_permission(household_id, 'members_add_tasks'));

-- Shopping.
drop policy if exists "members create shopping" on public.shopping_items;
drop policy if exists "members update shopping" on public.shopping_items;
drop policy if exists "members delete shopping" on public.shopping_items;

create policy "permitted members create shopping"
on public.shopping_items for insert to authenticated
with check (
  created_by = auth.uid()
  and public.household_permission(household_id, 'members_add_shopping')
);

create policy "permitted members update shopping"
on public.shopping_items for update to authenticated
using (public.household_permission(household_id, 'members_add_shopping'))
with check (public.household_permission(household_id, 'members_add_shopping'));

create policy "permitted members delete shopping"
on public.shopping_items for delete to authenticated
using (public.household_permission(household_id, 'members_add_shopping'));

-- Notices.
drop policy if exists "members create notices" on public.household_notices;
create policy "permitted members create notices"
on public.household_notices for insert to authenticated
with check (
  author_id = auth.uid()
  and public.household_permission(household_id, 'members_post_notices')
  and public.household_feature_enabled(household_id, 'notices_enabled')
);

-- Messages.
drop policy if exists "members send messages" on public.household_messages;
create policy "permitted members send messages"
on public.household_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.household_permission(household_id, 'members_message')
  and public.household_feature_enabled(household_id, 'messaging_enabled')
  and (
    recipient_id is null
    or (
      public.household_feature_enabled(household_id, 'direct_messages_enabled')
      and public.is_household_member(household_id, recipient_id)
    )
  )
);

-- The completion RPC is security-definer, so it must enforce the same rule itself.
create or replace function public.complete_chore(p_chore_id uuid, p_completion_type text default 'quick')
returns table (points_awarded integer, floors_awarded integer, full_clean_required boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chore public.chores%rowtype;
  v_settings public.chore_settings%rowtype;
  v_house public.households%rowtype;
  v_points integer;
  v_floors integer;
  v_quick_count integer;
  v_month date := date_trunc('month', current_date)::date;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_completion_type not in ('quick','full') then raise exception 'Invalid completion type'; end if;

  select * into v_chore
  from public.chores
  where id = p_chore_id and is_active
  for update;

  if not found then raise exception 'Task not found'; end if;
  if not public.is_household_member(v_chore.household_id, auth.uid()) then
    raise exception 'Not a member of this household';
  end if;
  if not public.household_permission(v_chore.household_id, 'members_complete_tasks', auth.uid()) then
    raise exception 'Your household role cannot complete tasks';
  end if;

  select * into v_settings from public.chore_settings where household_id = v_chore.household_id;
  select * into v_house from public.households where id = v_chore.household_id;

  v_points := v_chore.points;
  v_floors := case when coalesce(v_settings.difficulty_scaling, true) then v_chore.difficulty else 1 end;
  if v_chore.next_due_at is not null and v_chore.next_due_at < now() then
    v_floors := v_floors + coalesce(v_settings.overdue_bonus_levels, 0);
  end if;
  v_quick_count := case when p_completion_type = 'full' then 0 else v_chore.quick_clean_count + 1 end;

  update public.chores
  set quick_clean_count = v_quick_count,
      last_completed_at = now()
  where id = p_chore_id;

  insert into public.chore_completions (
    household_id, chore_id, user_id, completion_type,
    points_awarded, floors_awarded, month_key
  ) values (
    v_chore.household_id, p_chore_id, auth.uid(), p_completion_type,
    v_points, v_floors, v_month
  );

  insert into public.monthly_game_state (
    household_id, month_start, user_id, points, floors_climbed
  ) values (
    v_chore.household_id, v_month, auth.uid(), v_points, v_floors
  )
  on conflict (household_id, month_start, user_id)
  do update set
    points = monthly_game_state.points + excluded.points,
    floors_climbed = monthly_game_state.floors_climbed + excluded.floors_climbed;

  update public.monthly_game_state
  set is_winner = true,
      won_at = coalesce(won_at, now())
  where household_id = v_chore.household_id
    and month_start = v_month
    and user_id = auth.uid()
    and floors_climbed >= v_house.tower_height;

  return query select v_points, v_floors, (v_quick_count >= v_chore.full_clean_threshold);
end;
$$;

revoke all on function public.complete_chore(uuid, text) from public;
grant execute on function public.complete_chore(uuid, text) to authenticated;

commit;
