-- TaskTower initial schema
-- Run in a new Supabase project with the SQL editor or `supabase db push`.
-- The client must use only the public anon key; RLS below is the security boundary.

begin;
create extension if not exists pgcrypto;
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create table public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 1 and 40),
  skin_tone text not null default '#C98252',
  hair_style text not null default 'wave',
  hair_color text not null default '#4B2817',
  outfit_color text not null default '#7C5CFF',
  accessory text not null default 'none',
  celebration text not null default 'confetti',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_profiles_celebration_check check (celebration in ('confetti','fireworks','dance','trophy','wave','silly'))
);
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  owner_id uuid not null references auth.users(id) on delete restrict,
  tower_height integer not null default 20 check (tower_height between 5 and 100),
  monthly_reset_day integer not null default 1 check (monthly_reset_day between 1 and 28),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create table public.chore_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  categories jsonb not null default '["Kitchen","Bathroom","Living room","Laundry","Outdoor","Housework"]'::jsonb,
  default_full_clean_limit integer not null default 5 check (default_full_clean_limit between 1 and 99),
  base_points integer not null default 1 check (base_points between 1 and 20),
  difficulty_scaling boolean not null default true,
  overdue_bonus_levels integer not null default 1 check (overdue_bonus_levels between 0 and 10),
  winner_celebration text not null default 'confetti',
  game_options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chore_settings_celebration_check check (winner_celebration in ('confetti','fireworks','dance','trophy','wave','silly'))
);
create table public.household_join_codes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  description text not null default '',
  category text not null default 'Housework',
  frequency_type text not null default 'weekly' check (frequency_type in ('daily','weekly','fortnightly','monthly','custom_days','custom_interval')),
  frequency_interval integer not null default 1 check (frequency_interval > 0),
  frequency_unit text not null default 'days' check (frequency_unit in ('days','weeks','months')),
  difficulty integer not null default 1 check (difficulty between 1 and 5),
  points integer not null default 1 check (points between 1 and 100),
  reset_period interval,
  full_clean_threshold integer not null default 5 check (full_clean_threshold between 1 and 99),
  quick_clean_count integer not null default 0 check (quick_clean_count >= 0),
  last_completed_at timestamptz,
  next_due_at timestamptz,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.chore_completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  chore_id uuid not null references public.chores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completion_type text not null check (completion_type in ('quick','full')),
  points_awarded integer not null check (points_awarded >= 0),
  floors_awarded integer not null check (floors_awarded >= 0),
  completed_at timestamptz not null default now(),
  month_key date not null default date_trunc('month', current_date)::date
);
create table public.monthly_game_state (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month_start date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  floors_climbed integer not null default 0 check (floors_climbed >= 0),
  is_winner boolean not null default false,
  won_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, month_start, user_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  type text not null check (type in ('due_soon','overdue','full_clean','chore_completed','member_joined','member_left','monthly_winner','system')),
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform in ('android','ios','web')),
  device_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index household_members_user_idx on public.household_members(user_id);
create index chores_household_order_idx on public.chores(household_id, sort_order) where is_active;
create index chores_due_idx on public.chores(household_id, next_due_at) where is_active;
create index completions_household_month_idx on public.chore_completions(household_id, month_key, completed_at desc);
create index game_state_household_month_idx on public.monthly_game_state(household_id, month_start, floors_climbed desc);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
create or replace function public.is_household_member(p_household_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = p_household_id and hm.user_id = p_user_id
  );
$$;
create or replace function public.is_household_owner(p_household_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.households h
    where h.id = p_household_id and h.owner_id = p_user_id
  );
$$;
revoke all on function public.is_household_member(uuid, uuid) from public;
revoke all on function public.is_household_owner(uuid, uuid) from public;
grant execute on function public.is_household_member(uuid, uuid) to authenticated;
grant execute on function public.is_household_owner(uuid, uuid) to authenticated;
alter table public.player_profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.chore_settings enable row level security;
alter table public.household_join_codes enable row level security;
alter table public.chores enable row level security;
alter table public.chore_completions enable row level security;
alter table public.monthly_game_state enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
create policy "profiles visible to self and housemates"
on public.player_profiles for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and theirs.user_id = player_profiles.user_id
  )
);
create policy "users insert own profile" on public.player_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "users update own profile" on public.player_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members read households" on public.households for select to authenticated using (public.is_household_member(id));
create policy "users create owned households" on public.households for insert to authenticated with check (owner_id = auth.uid());
create policy "owners update households" on public.households for update to authenticated using (public.is_household_owner(id)) with check (owner_id = auth.uid());
create policy "owners delete households" on public.households for delete to authenticated using (public.is_household_owner(id));
create policy "members read household membership" on public.household_members for select to authenticated using (public.is_household_member(household_id));
create policy "owners add members" on public.household_members for insert to authenticated with check (public.is_household_owner(household_id));
create policy "owners update members" on public.household_members for update to authenticated using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
create policy "owners remove members" on public.household_members for delete to authenticated using (public.is_household_owner(household_id));
create policy "members read chore settings" on public.chore_settings for select to authenticated using (public.is_household_member(household_id));
create policy "owners insert chore settings" on public.chore_settings for insert to authenticated with check (public.is_household_owner(household_id));
create policy "owners update chore settings" on public.chore_settings for update to authenticated using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
create policy "members read join codes" on public.household_join_codes for select to authenticated using (public.is_household_member(household_id));
create policy "owners create join codes" on public.household_join_codes for insert to authenticated with check (public.is_household_owner(household_id) and created_by = auth.uid());
create policy "owners update join codes" on public.household_join_codes for update to authenticated using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
create policy "owners delete join codes" on public.household_join_codes for delete to authenticated using (public.is_household_owner(household_id));
create policy "members read chores" on public.chores for select to authenticated using (public.is_household_member(household_id));
create policy "members create chores" on public.chores for insert to authenticated with check (public.is_household_member(household_id) and created_by = auth.uid());
create policy "members update chores" on public.chores for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members delete chores" on public.chores for delete to authenticated using (public.is_household_member(household_id));
create policy "members read completions" on public.chore_completions for select to authenticated using (public.is_household_member(household_id));
create policy "members insert own completions" on public.chore_completions for insert to authenticated with check (public.is_household_member(household_id) and user_id = auth.uid());
create policy "members read monthly game" on public.monthly_game_state for select to authenticated using (public.is_household_member(household_id));
create policy "members insert own monthly game" on public.monthly_game_state for insert to authenticated with check (public.is_household_member(household_id) and user_id = auth.uid());
create policy "members update own monthly game" on public.monthly_game_state for update to authenticated using (public.is_household_member(household_id) and user_id = auth.uid()) with check (public.is_household_member(household_id) and user_id = auth.uid());
create policy "users read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "users update own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own notifications" on public.notifications for delete to authenticated using (user_id = auth.uid());
create policy "users read own push tokens" on public.push_tokens for select to authenticated using (user_id = auth.uid());
create policy "users add own push tokens" on public.push_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "users update own push tokens" on public.push_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own push tokens" on public.push_tokens for delete to authenticated using (user_id = auth.uid());
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.player_profiles (user_id, username)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), split_part(coalesce(new.email, 'New climber'), '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger player_profiles_updated before update on public.player_profiles for each row execute function public.set_updated_at();
create trigger households_updated before update on public.households for each row execute function public.set_updated_at();
create trigger chore_settings_updated before update on public.chore_settings for each row execute function public.set_updated_at();
create trigger chores_updated before update on public.chores for each row execute function public.set_updated_at();
create trigger monthly_game_state_updated before update on public.monthly_game_state for each row execute function public.set_updated_at();
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
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'House name is too short'; end if;

  loop
    v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (select 1 from public.household_join_codes where code = v_code);
  end loop;

  insert into public.households (name, owner_id) values (trim(p_name), auth.uid()) returning id into v_household_id;
  insert into public.household_members (household_id, user_id, role) values (v_household_id, auth.uid(), 'owner');
  insert into public.chore_settings (household_id) values (v_household_id);
  insert into public.household_join_codes (household_id, code, created_by) values (v_household_id, v_code, auth.uid());

  return query select v_household_id, v_code;
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
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_code
  from public.household_join_codes
  where code = upper(trim(p_code)) and active
  for update;

  if not found then raise exception 'That invite code is not active'; end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then raise exception 'That invite code has expired'; end if;
  if v_code.max_uses is not null and v_code.use_count >= v_code.max_uses then raise exception 'That invite code has reached its limit'; end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_code.household_id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  update public.household_join_codes set use_count = use_count + 1 where id = v_code.id;
  select name into v_name from public.households where id = v_code.household_id;
  return query select v_code.household_id, v_name;
end;
$$;
create or replace function public.leave_house(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_household_owner(p_household_id, auth.uid()) then
    raise exception 'Transfer ownership or delete the house before leaving';
  end if;
  delete from public.household_members where household_id = p_household_id and user_id = auth.uid();
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
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_completion_type not in ('quick','full') then raise exception 'Invalid completion type'; end if;

  select * into v_chore from public.chores where id = p_chore_id and is_active for update;
  if not found then raise exception 'Chore not found'; end if;
  if not public.is_household_member(v_chore.household_id, auth.uid()) then raise exception 'Not a member of this house'; end if;

  select * into v_settings from public.chore_settings where household_id = v_chore.household_id;
  select * into v_house from public.households where id = v_chore.household_id;
  v_points := v_chore.points;
  v_floors := case when coalesce(v_settings.difficulty_scaling, true) then v_chore.difficulty else 1 end;
  if v_chore.next_due_at is not null and v_chore.next_due_at < now() then
    v_floors := v_floors + coalesce(v_settings.overdue_bonus_levels, 0);
  end if;
  v_quick_count := case when p_completion_type = 'full' then 0 else v_chore.quick_clean_count + 1 end;

  update public.chores
  set quick_clean_count = v_quick_count, last_completed_at = now()
  where id = p_chore_id;

  insert into public.chore_completions (household_id, chore_id, user_id, completion_type, points_awarded, floors_awarded, month_key)
  values (v_chore.household_id, p_chore_id, auth.uid(), p_completion_type, v_points, v_floors, v_month);

  insert into public.monthly_game_state (household_id, month_start, user_id, points, floors_climbed)
  values (v_chore.household_id, v_month, auth.uid(), v_points, v_floors)
  on conflict (household_id, month_start, user_id)
  do update set points = monthly_game_state.points + excluded.points,
                floors_climbed = monthly_game_state.floors_climbed + excluded.floors_climbed;

  update public.monthly_game_state
  set is_winner = true, won_at = coalesce(won_at, now())
  where household_id = v_chore.household_id
    and month_start = v_month
    and user_id = auth.uid()
    and floors_climbed >= v_house.tower_height;

  return query select v_points, v_floors, (v_quick_count >= v_chore.full_clean_threshold);
end;
$$;
revoke all on function public.create_house(text) from public;
revoke all on function public.join_house(text) from public;
revoke all on function public.leave_house(uuid) from public;
revoke all on function public.complete_chore(uuid, text) from public;
grant execute on function public.create_house(text) to authenticated;
grant execute on function public.join_house(text) to authenticated;
grant execute on function public.leave_house(uuid) to authenticated;
grant execute on function public.complete_chore(uuid, text) to authenticated;
create or replace function public.notify_chore_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chore_name text;
  v_username text;
begin
  select display_name into v_chore_name from public.chores where id = new.chore_id;
  select username into v_username from public.player_profiles where user_id = new.user_id;
  insert into public.notifications (user_id, household_id, type, title, body, data)
  select hm.user_id, new.household_id, 'chore_completed',
         coalesce(v_username, 'A housemate') || ' climbed ' || new.floors_awarded || case when new.floors_awarded = 1 then ' floor!' else ' floors!' end,
         v_chore_name || ' is complete.',
         jsonb_build_object('chore_id', new.chore_id, 'completion_id', new.id)
  from public.household_members hm
  where hm.household_id = new.household_id and hm.user_id <> new.user_id;
  return new;
end;
$$;
create trigger chore_completion_notification after insert on public.chore_completions for each row execute function public.notify_chore_completion();
-- Enable the tables used by live household screens for Supabase Realtime.
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['household_members','chores','chore_completions','monthly_game_state','notifications']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;
commit;
