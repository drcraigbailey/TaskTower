-- Replace calendar-month score resets with owner-controlled progress cycles.
-- Also normalise invite codes at the database boundary so spaces and dashes are harmless.

begin;

alter table public.households
  add column if not exists progress_cycle_id uuid default gen_random_uuid();

update public.households
set progress_cycle_id = gen_random_uuid()
where progress_cycle_id is null;

alter table public.households
  alter column progress_cycle_id set default gen_random_uuid(),
  alter column progress_cycle_id set not null;

alter table public.monthly_game_state
  add column if not exists progress_cycle_id uuid;

-- Preserve the currently visible calendar-month scores as the first manual cycle.
update public.monthly_game_state game
set progress_cycle_id = house.progress_cycle_id
from public.households house
where game.household_id = house.id
  and game.month_start = date_trunc('month', current_date)::date
  and game.progress_cycle_id is null;

-- Older score rows remain historical and receive independent cycle identifiers.
update public.monthly_game_state
set progress_cycle_id = gen_random_uuid()
where progress_cycle_id is null;

alter table public.monthly_game_state
  alter column progress_cycle_id set default gen_random_uuid(),
  alter column progress_cycle_id set not null;

-- The old month-based uniqueness would prevent two manual resets in one month.
alter table public.monthly_game_state
  drop constraint if exists monthly_game_state_household_id_month_start_user_id_key;

create unique index if not exists monthly_game_state_cycle_user_key
on public.monthly_game_state (household_id, progress_cycle_id, user_id);

create index if not exists monthly_game_state_active_cycle_idx
on public.monthly_game_state (household_id, progress_cycle_id, floors_climbed desc);

alter table public.chore_completions
  add column if not exists progress_cycle_id uuid;

update public.chore_completions completion
set progress_cycle_id = house.progress_cycle_id
from public.households house
where completion.household_id = house.id
  and completion.month_key = date_trunc('month', current_date)::date
  and completion.progress_cycle_id is null;

update public.chore_completions
set progress_cycle_id = gen_random_uuid()
where progress_cycle_id is null;

alter table public.chore_completions
  alter column progress_cycle_id set default gen_random_uuid(),
  alter column progress_cycle_id set not null;

create index if not exists chore_completions_cycle_idx
on public.chore_completions (household_id, progress_cycle_id, completed_at desc);

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

  select * into v_code
  from public.household_join_codes
  where regexp_replace(upper(code), '[^A-Z0-9]', '', 'g') = v_clean_code
    and active
  for update;

  if not found then
    raise exception 'That invite code is not active';
  end if;

  if v_code.expires_at is not null and v_code.expires_at <= now() then
    raise exception 'That invite code has expired';
  end if;

  if v_code.max_uses is not null and v_code.use_count >= v_code.max_uses then
    raise exception 'That invite code has reached its limit';
  end if;

  select name into v_name
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

create or replace function public.reset_household_progress(p_household_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_household_owner(p_household_id, auth.uid()) then
    raise exception 'Only the household owner can reset progress';
  end if;

  update public.households
  set progress_cycle_id = v_cycle_id,
      updated_at = now()
  where id = p_household_id;

  if not found then
    raise exception 'Household not found';
  end if;

  insert into public.household_activity (
    household_id,
    actor_id,
    event_type,
    subject_type,
    subject_id,
    summary,
    metadata
  ) values (
    p_household_id,
    auth.uid(),
    'progress_reset',
    'household',
    p_household_id,
    'started a new household progress cycle',
    jsonb_build_object('tone', 'blue', 'progress_cycle_id', v_cycle_id)
  );

  return v_cycle_id;
end;
$$;

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
  v_cycle_id uuid;
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

  select * into v_settings
  from public.chore_settings
  where household_id = v_chore.household_id;

  select * into v_house
  from public.households
  where id = v_chore.household_id
  for update;

  v_cycle_id := v_house.progress_cycle_id;
  v_points := v_chore.points;
  v_floors := case when coalesce(v_settings.difficulty_scaling, true) then v_chore.difficulty else 1 end;

  if v_chore.next_due_at is not null and v_chore.next_due_at < now() then
    v_floors := v_floors + coalesce(v_settings.overdue_bonus_levels, 0);
  end if;

  v_quick_count := case
    when p_completion_type = 'full' then 0
    else v_chore.quick_clean_count + 1
  end;

  update public.chores
  set quick_clean_count = v_quick_count,
      last_completed_at = now()
  where id = p_chore_id;

  insert into public.chore_completions (
    household_id,
    chore_id,
    user_id,
    completion_type,
    points_awarded,
    floors_awarded,
    month_key,
    progress_cycle_id
  ) values (
    v_chore.household_id,
    p_chore_id,
    auth.uid(),
    p_completion_type,
    v_points,
    v_floors,
    v_month,
    v_cycle_id
  );

  insert into public.monthly_game_state (
    household_id,
    month_start,
    user_id,
    points,
    floors_climbed,
    progress_cycle_id
  ) values (
    v_chore.household_id,
    v_month,
    auth.uid(),
    v_points,
    v_floors,
    v_cycle_id
  )
  on conflict (household_id, progress_cycle_id, user_id)
  do update set
    points = monthly_game_state.points + excluded.points,
    floors_climbed = monthly_game_state.floors_climbed + excluded.floors_climbed,
    month_start = excluded.month_start;

  update public.monthly_game_state
  set is_winner = true,
      won_at = coalesce(won_at, now())
  where household_id = v_chore.household_id
    and progress_cycle_id = v_cycle_id
    and user_id = auth.uid()
    and floors_climbed >= v_house.tower_height;

  return query
  select v_points, v_floors, (v_quick_count >= v_chore.full_clean_threshold);
end;
$$;

revoke all on function public.join_house(text) from public;
revoke all on function public.reset_household_progress(uuid) from public;
revoke all on function public.complete_chore(uuid, text) from public;

grant execute on function public.join_house(text) to authenticated;
grant execute on function public.reset_household_progress(uuid) to authenticated;
grant execute on function public.complete_chore(uuid, text) to authenticated;

commit;
