-- Complete the Dwellio household feature wiring.
-- Apply after 001_tasktower.sql and 002_adult_household_hub.sql.

begin;
-- Existing households pre-date the adult settings table.
insert into public.household_settings (household_id)
select h.id
from public.households h
where not exists (
  select 1 from public.household_settings s where s.household_id = h.id
);
create or replace function public.create_household_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_settings (household_id)
  values (new.id)
  on conflict (household_id) do nothing;
  return new;
end;
$$;
drop trigger if exists create_household_settings_after_insert on public.households;
create trigger create_household_settings_after_insert
after insert on public.households
for each row execute function public.create_household_settings();
-- Owners and admins can manage the adult household settings.
drop policy if exists "owners manage household settings" on public.household_settings;
drop policy if exists "admins manage household settings" on public.household_settings;
create policy "admins manage household settings"
on public.household_settings for all to authenticated
using (public.is_household_admin(household_id))
with check (public.is_household_admin(household_id));
-- Direct-message recipients must belong to the same household.
drop policy if exists "members send messages" on public.household_messages;
create policy "members send messages"
on public.household_messages for insert to authenticated
with check (
  public.is_household_member(household_id)
  and sender_id = auth.uid()
  and (recipient_id is null or public.is_household_member(household_id, recipient_id))
);
-- Joining is capped at ten people and repeat joins no longer consume invite uses.
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
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_code
  from public.household_join_codes
  where code = upper(trim(p_code)) and active
  for update;

  if not found then raise exception 'That invite code is not active'; end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then raise exception 'That invite code has expired'; end if;
  if v_code.max_uses is not null and v_code.use_count >= v_code.max_uses then raise exception 'That invite code has reached its limit'; end if;

  if not exists (
    select 1 from public.household_members
    where household_id = v_code.household_id and user_id = auth.uid()
  ) and (
    select count(*) from public.household_members where household_id = v_code.household_id
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

  select name into v_name from public.households where id = v_code.household_id;
  return query select v_code.household_id, v_name;
end;
$$;
revoke all on function public.join_house(text) from public;
grant execute on function public.join_house(text) to authenticated;
create or replace function public.log_chore_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select display_name into v_name from public.chores where id = new.chore_id;
  insert into public.household_activity (
    household_id, actor_id, event_type, subject_type, subject_id, summary, metadata
  ) values (
    new.household_id,
    new.user_id,
    'task_completed',
    'task',
    new.chore_id,
    case when new.completion_type = 'full' then 'completed a full clean' else 'completed a quick clean' end,
    jsonb_build_object('subject_name', coalesce(v_name, 'Task'), 'completion_type', new.completion_type, 'tone', 'green')
  );
  return new;
end;
$$;
drop trigger if exists chore_completion_activity on public.chore_completions;
create trigger chore_completion_activity
after insert on public.chore_completions
for each row execute function public.log_chore_activity();
create or replace function public.log_shopping_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_summary text;
  v_type text;
  v_tone text := 'amber';
  v_notification_type text;
begin
  v_actor := coalesce(new.purchased_by, auth.uid(), new.created_by);

  if tg_op = 'INSERT' then
    v_type := 'shopping_added';
    v_summary := 'added a shopping item';
  elsif new.state is distinct from old.state then
    v_type := 'shopping_state_changed';
    v_summary := case new.state
      when 'running_low' then 'marked an item as running low'
      when 'out' then 'marked an item as out of stock'
      when 'shopping_list' then 'added an item to the shopping list'
      when 'purchased' then 'marked an item as purchased'
      when 'stocked' then 'marked an item as stocked'
      else 'updated a shopping item'
    end;
    if new.state in ('purchased', 'stocked') then v_tone := 'green'; end if;
  else
    return new;
  end if;

  insert into public.household_activity (
    household_id, actor_id, event_type, subject_type, subject_id, summary, metadata
  ) values (
    new.household_id,
    v_actor,
    v_type,
    'shopping_item',
    new.id,
    v_summary,
    jsonb_build_object('subject_name', new.name, 'state', new.state, 'tone', v_tone)
  );

  if new.state in ('running_low', 'out') and (tg_op = 'INSERT' or new.state is distinct from old.state) then
    v_notification_type := case when new.state = 'out' then 'shopping_out' else 'shopping_low' end;
    insert into public.notifications (user_id, household_id, type, title, body, data)
    select hm.user_id,
           new.household_id,
           v_notification_type,
           case when new.state = 'out' then new.name || ' is out' else new.name || ' is running low' end,
           'Open the household shopping list to update it.',
           jsonb_build_object('shopping_item_id', new.id)
    from public.household_members hm
    where hm.household_id = new.household_id
      and hm.user_id <> v_actor;
  end if;

  return new;
end;
$$;
drop trigger if exists shopping_item_activity on public.shopping_items;
create trigger shopping_item_activity
after insert or update on public.shopping_items
for each row execute function public.log_shopping_activity();
create or replace function public.log_notice_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_activity (
    household_id, actor_id, event_type, subject_type, subject_id, summary, metadata
  ) values (
    new.household_id,
    new.author_id,
    'notice_posted',
    'notice',
    new.id,
    'posted a notice',
    jsonb_build_object('subject_name', new.title, 'priority', new.priority, 'tone', 'blue')
  );

  insert into public.notifications (user_id, household_id, type, title, body, data)
  select hm.user_id,
         new.household_id,
         case when new.priority = 'urgent' then 'urgent_notice' else 'notice' end,
         new.title,
         left(new.body, 240),
         jsonb_build_object('notice_id', new.id)
  from public.household_members hm
  where hm.household_id = new.household_id
    and hm.user_id <> new.author_id;

  return new;
end;
$$;
drop trigger if exists household_notice_activity on public.household_notices;
create trigger household_notice_activity
after insert on public.household_notices
for each row execute function public.log_notice_activity();
create or replace function public.notify_household_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender text;
begin
  select username into v_sender from public.player_profiles where user_id = new.sender_id;

  insert into public.notifications (user_id, household_id, type, title, body, data)
  select hm.user_id,
         new.household_id,
         case when new.recipient_id is null then 'household_message' else 'direct_message' end,
         coalesce(v_sender, 'A housemate') || case when new.recipient_id is null then ' sent a household message' else ' sent you a message' end,
         left(new.body, 240),
         jsonb_build_object('message_id', new.id)
  from public.household_members hm
  where hm.household_id = new.household_id
    and hm.user_id <> new.sender_id
    and (new.recipient_id is null or hm.user_id = new.recipient_id);

  return new;
end;
$$;
drop trigger if exists household_message_notification on public.household_messages;
create trigger household_message_notification
after insert on public.household_messages
for each row execute function public.notify_household_message();
create or replace function public.log_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select username into v_name from public.player_profiles where user_id = new.user_id;

  insert into public.household_activity (
    household_id, actor_id, event_type, subject_type, subject_id, summary, metadata
  ) values (
    new.household_id,
    new.user_id,
    'member_joined',
    'member',
    new.user_id,
    'joined the household',
    jsonb_build_object('subject_name', coalesce(v_name, 'New member'), 'tone', 'blue')
  );

  insert into public.notifications (user_id, household_id, type, title, body, data)
  select hm.user_id,
         new.household_id,
         'member_joined',
         coalesce(v_name, 'A new member') || ' joined',
         'Your household now has a new member.',
         jsonb_build_object('member_id', new.user_id)
  from public.household_members hm
  where hm.household_id = new.household_id
    and hm.user_id <> new.user_id;

  return new;
end;
$$;
drop trigger if exists household_member_joined_activity on public.household_members;
create trigger household_member_joined_activity
after insert on public.household_members
for each row execute function public.log_member_joined();
create index if not exists notice_acknowledgements_user_idx
on public.notice_acknowledgements(user_id, acknowledged_at desc);
-- Keep all new shared screens fresh without manual reloads.
do $$
declare v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['household_settings','household_rooms','task_categories'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;
commit;
