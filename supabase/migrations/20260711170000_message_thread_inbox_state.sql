begin;

create table if not exists public.household_message_thread_state (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  other_user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  hidden_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id, other_user_id),
  constraint household_message_thread_state_distinct_users check (user_id <> other_user_id)
);

create index if not exists household_message_thread_state_user_active_idx
  on public.household_message_thread_state(user_id, household_id, hidden_at, updated_at desc);

create index if not exists household_message_thread_state_restore_idx
  on public.household_message_thread_state(household_id, other_user_id, hidden_at)
  where hidden_at is not null;

create index if not exists household_messages_direct_pair_latest_idx
  on public.household_messages(household_id, author_id, recipient_id, created_at desc)
  where recipient_id is not null;

create index if not exists household_messages_direct_unread_idx
  on public.household_messages(household_id, recipient_id, author_id, created_at desc)
  where recipient_id is not null;

alter table public.household_message_thread_state enable row level security;

revoke all on public.household_message_thread_state from anon;
grant select, insert, update on public.household_message_thread_state to authenticated;

drop policy if exists "users read own message thread state" on public.household_message_thread_state;
create policy "users read own message thread state"
on public.household_message_thread_state for select to authenticated
using (
  user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

drop policy if exists "users create own message thread state" on public.household_message_thread_state;
create policy "users create own message thread state"
on public.household_message_thread_state for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
  and public.is_household_member(household_id, other_user_id)
);

drop policy if exists "users update own message thread state" on public.household_message_thread_state;
create policy "users update own message thread state"
on public.household_message_thread_state for update to authenticated
using (
  user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
  and public.is_household_member(household_id, other_user_id)
);

create or replace function public.touch_household_message_thread_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.recipient_id is null then
    return new;
  end if;

  insert into public.household_message_thread_state (
    household_id,
    user_id,
    other_user_id,
    read_at,
    hidden_at,
    updated_at
  )
  values (
    new.household_id,
    new.author_id,
    new.recipient_id,
    new.created_at,
    null,
    now()
  )
  on conflict (household_id, user_id, other_user_id)
  do update set
    read_at = greatest(
      coalesce(public.household_message_thread_state.read_at, '-infinity'::timestamptz),
      excluded.read_at
    ),
    hidden_at = null,
    updated_at = now();

  insert into public.household_message_thread_state (
    household_id,
    user_id,
    other_user_id,
    read_at,
    hidden_at,
    updated_at
  )
  values (
    new.household_id,
    new.recipient_id,
    new.author_id,
    null,
    null,
    now()
  )
  on conflict (household_id, user_id, other_user_id)
  do update set
    hidden_at = null,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists household_message_thread_state_after_insert on public.household_messages;
create trigger household_message_thread_state_after_insert
after insert on public.household_messages
for each row execute function public.touch_household_message_thread_state();

create or replace function public.mark_household_message_thread_read(
  p_household_id uuid,
  p_other_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_household_member(p_household_id, auth.uid())
    or not public.is_household_member(p_household_id, p_other_user_id) then
    raise exception 'Not a member of this household';
  end if;

  if auth.uid() = p_other_user_id then
    raise exception 'Choose another household member';
  end if;

  insert into public.household_message_thread_state (
    household_id,
    user_id,
    other_user_id,
    read_at,
    hidden_at,
    updated_at
  )
  values (
    p_household_id,
    auth.uid(),
    p_other_user_id,
    now(),
    null,
    now()
  )
  on conflict (household_id, user_id, other_user_id)
  do update set
    read_at = now(),
    hidden_at = null,
    updated_at = now();
end;
$$;

create or replace function public.hide_household_message_thread(
  p_household_id uuid,
  p_other_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_household_member(p_household_id, auth.uid())
    or not public.is_household_member(p_household_id, p_other_user_id) then
    raise exception 'Not a member of this household';
  end if;

  if auth.uid() = p_other_user_id then
    raise exception 'Choose another household member';
  end if;

  insert into public.household_message_thread_state (
    household_id,
    user_id,
    other_user_id,
    read_at,
    hidden_at,
    updated_at
  )
  values (
    p_household_id,
    auth.uid(),
    p_other_user_id,
    now(),
    now(),
    now()
  )
  on conflict (household_id, user_id, other_user_id)
  do update set
    read_at = now(),
    hidden_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.mark_household_message_thread_read(uuid, uuid) from public;
grant execute on function public.mark_household_message_thread_read(uuid, uuid) to authenticated;

revoke all on function public.hide_household_message_thread(uuid, uuid) from public;
grant execute on function public.hide_household_message_thread(uuid, uuid) to authenticated;

insert into public.household_message_thread_state (
  household_id,
  user_id,
  other_user_id,
  read_at,
  hidden_at,
  updated_at
)
select household_id, user_id, other_user_id, now(), null, now()
from (
  select distinct household_id, author_id as user_id, recipient_id as other_user_id
  from public.household_messages
  where recipient_id is not null
  union
  select distinct household_id, recipient_id as user_id, author_id as other_user_id
  from public.household_messages
  where recipient_id is not null
) existing_threads
where user_id is not null
  and other_user_id is not null
  and user_id <> other_user_id
on conflict (household_id, user_id, other_user_id) do nothing;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'household_message_thread_state'
    ) then
    alter publication supabase_realtime add table public.household_message_thread_state;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
