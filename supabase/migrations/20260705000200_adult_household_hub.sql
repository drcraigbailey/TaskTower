-- Adult household operations features for TaskTowers.
-- Additive migration: preserves the existing authentication, household and task data.

begin;

alter table public.household_members drop constraint if exists household_members_role_check;
alter table public.household_members add constraint household_members_role_check check (role in ('owner','admin','member','guest'));

alter table public.chores
  add column if not exists room text,
  add column if not exists urgency text not null default 'normal' check (urgency in ('low','normal','high','critical')),
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists responsibility text not null default 'shared' check (responsibility in ('assigned','shared')),
  add column if not exists amber_after interval,
  add column if not exists red_after interval,
  add column if not exists estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  add column if not exists paused_at timestamptz,
  add column if not exists photo_required boolean not null default false,
  add column if not exists notes text not null default '';

create table public.household_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  permissions jsonb not null default '{"members_add_tasks":true,"members_complete_tasks":true,"members_add_shopping":true,"members_post_notices":true,"members_message":true}'::jsonb,
  notification_defaults jsonb not null default '{}'::jsonb,
  contribution_mode text not null default 'neutral' check (contribution_mode in ('off','neutral','household_total','private','visible','ranking')),
  messaging_enabled boolean not null default true,
  direct_messages_enabled boolean not null default true,
  notices_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.household_rooms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  icon text,
  sort_order integer not null default 0,
  unique (household_id, name)
);

create table public.task_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  icon text,
  colour text,
  sort_order integer not null default 0,
  unique (household_id, name)
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  category text not null default 'Other',
  state text not null default 'shopping_list' check (state in ('stocked','running_low','out','shopping_list','purchased')),
  quantity numeric,
  unit text,
  preferred_brand text,
  note text not null default '',
  estimated_price numeric(10,2) check (estimated_price is null or estimated_price >= 0),
  assigned_to uuid references auth.users(id) on delete set null,
  is_favourite boolean not null default false,
  purchased_at timestamptz,
  purchased_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_notices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '',
  priority text not null default 'normal' check (priority in ('normal','important','urgent')),
  author_id uuid not null references auth.users(id) on delete restrict,
  pinned boolean not null default false,
  expires_at timestamptz,
  linked_task_id uuid references public.chores(id) on delete set null,
  linked_shopping_item_id uuid references public.shopping_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notice_acknowledgements (
  notice_id uuid not null references public.household_notices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);

create table public.household_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  linked_task_id uuid references public.chores(id) on delete set null,
  linked_shopping_item_id uuid references public.shopping_items(id) on delete set null,
  linked_notice_id uuid references public.household_notices(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.household_activity (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  subject_type text,
  subject_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('due_soon','overdue','full_clean','chore_completed','member_joined','member_left','monthly_winner','notice','urgent_notice','household_message','direct_message','shopping_low','shopping_out','shopping_assigned','invitation','role_changed','settings_changed','system'));

create or replace function public.is_household_admin(p_household_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = p_user_id and role in ('owner','admin')
  );
$$;
revoke all on function public.is_household_admin(uuid, uuid) from public;
grant execute on function public.is_household_admin(uuid, uuid) to authenticated;

create index shopping_household_state_idx on public.shopping_items(household_id, state, created_at desc);
create index notices_household_active_idx on public.household_notices(household_id, pinned desc, created_at desc);
create index messages_household_created_idx on public.household_messages(household_id, created_at desc);
create index messages_direct_idx on public.household_messages(household_id, recipient_id, created_at desc) where recipient_id is not null;
create index activity_household_created_idx on public.household_activity(household_id, created_at desc);

alter table public.household_settings enable row level security;
alter table public.household_rooms enable row level security;
alter table public.task_categories enable row level security;
alter table public.shopping_items enable row level security;
alter table public.household_notices enable row level security;
alter table public.notice_acknowledgements enable row level security;
alter table public.household_messages enable row level security;
alter table public.household_activity enable row level security;

create policy "members read household settings" on public.household_settings for select to authenticated using (public.is_household_member(household_id));
create policy "owners manage household settings" on public.household_settings for all to authenticated using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
create policy "members read rooms" on public.household_rooms for select to authenticated using (public.is_household_member(household_id));
create policy "admins manage rooms" on public.household_rooms for all to authenticated using (public.is_household_admin(household_id)) with check (public.is_household_admin(household_id));
create policy "members read categories" on public.task_categories for select to authenticated using (public.is_household_member(household_id));
create policy "admins manage categories" on public.task_categories for all to authenticated using (public.is_household_admin(household_id)) with check (public.is_household_admin(household_id));
create policy "members read shopping" on public.shopping_items for select to authenticated using (public.is_household_member(household_id));
create policy "members create shopping" on public.shopping_items for insert to authenticated with check (public.is_household_member(household_id) and created_by = auth.uid());
create policy "members update shopping" on public.shopping_items for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members delete shopping" on public.shopping_items for delete to authenticated using (public.is_household_member(household_id));
create policy "members read notices" on public.household_notices for select to authenticated using (public.is_household_member(household_id));
create policy "members create notices" on public.household_notices for insert to authenticated with check (public.is_household_member(household_id) and author_id = auth.uid());
create policy "authors update notices" on public.household_notices for update to authenticated using (author_id = auth.uid() or public.is_household_owner(household_id));
create policy "authors delete notices" on public.household_notices for delete to authenticated using (author_id = auth.uid() or public.is_household_owner(household_id));
create policy "members read acknowledgements" on public.notice_acknowledgements for select to authenticated using (exists (select 1 from public.household_notices n where n.id = notice_id and public.is_household_member(n.household_id)));
create policy "users acknowledge notices" on public.notice_acknowledgements for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.household_notices n where n.id = notice_id and public.is_household_member(n.household_id)));
create policy "members read household messages" on public.household_messages for select to authenticated using (public.is_household_member(household_id) and (recipient_id is null or recipient_id = auth.uid() or sender_id = auth.uid()));
create policy "members send messages" on public.household_messages for insert to authenticated with check (public.is_household_member(household_id) and sender_id = auth.uid());
create policy "senders update messages" on public.household_messages for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy "members read activity" on public.household_activity for select to authenticated using (public.is_household_member(household_id));

create trigger household_settings_updated before update on public.household_settings for each row execute function public.set_updated_at();
create trigger shopping_items_updated before update on public.shopping_items for each row execute function public.set_updated_at();
create trigger household_notices_updated before update on public.household_notices for each row execute function public.set_updated_at();

do $$
declare v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['shopping_items','household_notices','notice_acknowledgements','household_messages','household_activity'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

commit;
