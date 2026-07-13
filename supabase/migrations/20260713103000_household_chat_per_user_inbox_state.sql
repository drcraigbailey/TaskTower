begin;

alter table public.household_message_thread_state
  drop constraint if exists household_message_thread_state_distinct_users;

alter table public.household_message_thread_state
  add column if not exists thread_key text;

update public.household_message_thread_state
set thread_key = coalesce(other_user_id::text, 'household')
where thread_key is null;

alter table public.household_message_thread_state
  drop constraint if exists household_message_thread_state_pkey;

alter table public.household_message_thread_state
  alter column other_user_id drop not null;

alter table public.household_message_thread_state
  alter column thread_key set not null;

alter table public.household_message_thread_state
  add constraint household_message_thread_state_pkey
  primary key (household_id, user_id, thread_key);

alter table public.household_message_thread_state
  add constraint household_message_thread_state_thread_key_check
  check (
    (other_user_id is null and thread_key = 'household')
    or (other_user_id is not null and thread_key = other_user_id::text)
  );

alter table public.household_message_thread_state
  add constraint household_message_thread_state_distinct_users
  check (other_user_id is null or user_id <> other_user_id);

create index if not exists household_message_thread_state_household_restore_idx
  on public.household_message_thread_state(household_id, user_id, hidden_at)
  where thread_key = 'household' and hidden_at is not null;

drop policy if exists "users create own message thread state" on public.household_message_thread_state;
create policy "users create own message thread state"
on public.household_message_thread_state for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
  and (other_user_id is null or public.is_household_member(household_id, other_user_id))
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
  and (other_user_id is null or public.is_household_member(household_id, other_user_id))
);

create or replace function public.touch_household_message_thread_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.recipient_id is null then
    insert into public.household_message_thread_state (
      household_id,
      user_id,
      other_user_id,
      thread_key,
      read_at,
      hidden_at,
      updated_at
    )
    select
      new.household_id,
      member.user_id,
      null,
      'household',
      case when member.user_id = new.author_id then new.created_at else null end,
      null,
      now()
    from public.household_members member
    where member.household_id = new.household_id
    on conflict (household_id, user_id, thread_key)
    do update set
      read_at = case
        when public.household_message_thread_state.user_id = new.author_id then greatest(
          coalesce(public.household_message_thread_state.read_at, '-infinity'::timestamptz),
          new.created_at
        )
        else public.household_message_thread_state.read_at
      end,
      hidden_at = null,
      updated_at = now();

    return new;
  end if;

  insert into public.household_message_thread_state (
    household_id,
    user_id,
    other_user_id,
    thread_key,
    read_at,
    hidden_at,
    updated_at
  )
  values (
    new.household_id,
    new.author_id,
    new.recipient_id,
    new.recipient_id::text,
    new.created_at,
    null,
    now()
  )
  on conflict (household_id, user_id, thread_key)
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
    thread_key,
    read_at,
    hidden_at,
    updated_at
  )
  values (
    new.household_id,
    new.recipient_id,
    new.author_id,
    new.author_id::text,
    null,
    null,
    now()
  )
  on conflict (household_id, user_id, thread_key)
  do update set
    hidden_at = null,
    updated_at = now();

  return new;
end;
$$;

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
    thread_key,
    read_at,
    hidden_at,
    updated_at
  )
  values (
    p_household_id,
    auth.uid(),
    p_other_user_id,
    p_other_user_id::text,
    now(),
    null,
    now()
  )
  on conflict (household_id, user_id, thread_key)
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
    thread_key,
    read_at,
    hidden_at,
    updated_at
  )
  values (
    p_household_id,
    auth.uid(),
    p_other_user_id,
    p_other_user_id::text,
    now(),
    now(),
    now()
  )
  on conflict (household_id, user_id, thread_key)
  do update set
    read_at = now(),
    hidden_at = now(),
    updated_at = now();
end;
$$;

create or replace function public.mark_household_chat_read(
  p_household_id uuid
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

  if not public.is_household_member(p_household_id, auth.uid()) then
    raise exception 'Not a member of this household';
  end if;

  insert into public.household_message_thread_state (
    household_id,
    user_id,
    other_user_id,
    thread_key,
    read_at,
    hidden_at,
    updated_at
  )
  values (
    p_household_id,
    auth.uid(),
    null,
    'household',
    now(),
    null,
    now()
  )
  on conflict (household_id, user_id, thread_key)
  do update set
    read_at = now(),
    hidden_at = null,
    updated_at = now();
end;
$$;

create or replace function public.hide_household_chat_thread(
  p_household_id uuid
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

  if not public.is_household_member(p_household_id, auth.uid()) then
    raise exception 'Not a member of this household';
  end if;

  insert into public.household_message_thread_state (
    household_id,
    user_id,
    other_user_id,
    thread_key,
    read_at,
    hidden_at,
    updated_at
  )
  values (
    p_household_id,
    auth.uid(),
    null,
    'household',
    now(),
    now(),
    now()
  )
  on conflict (household_id, user_id, thread_key)
  do update set
    read_at = now(),
    hidden_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.mark_household_chat_read(uuid) from public;
grant execute on function public.mark_household_chat_read(uuid) to authenticated;

revoke all on function public.hide_household_chat_thread(uuid) from public;
grant execute on function public.hide_household_chat_thread(uuid) to authenticated;

insert into public.household_message_thread_state (
  household_id,
  user_id,
  other_user_id,
  thread_key,
  read_at,
  hidden_at,
  updated_at
)
select distinct
  message.household_id,
  member.user_id,
  null::uuid,
  'household',
  now(),
  null::timestamptz,
  now()
from public.household_messages message
join public.household_members member
  on member.household_id = message.household_id
where message.recipient_id is null
on conflict (household_id, user_id, thread_key) do nothing;

notify pgrst, 'reload schema';

commit;
