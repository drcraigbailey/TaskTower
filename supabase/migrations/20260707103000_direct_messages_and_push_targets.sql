begin;

alter table public.household_messages
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade;

create index if not exists household_messages_direct_idx
  on public.household_messages(household_id, recipient_id, created_at desc)
  where recipient_id is not null;

drop policy if exists "members read household messages" on public.household_messages;
create policy "members read household messages"
on public.household_messages for select to authenticated
using (
  public.is_household_member(household_id)
  and (
    recipient_id is null
    or recipient_id = auth.uid()
    or author_id = auth.uid()
  )
);

drop policy if exists "members send household messages" on public.household_messages;
create policy "members send household messages"
on public.household_messages for insert to authenticated
with check (
  public.is_household_member(household_id)
  and author_id = auth.uid()
  and (
    recipient_id is null
    or public.is_household_member(household_id, recipient_id)
  )
);

create or replace function public.notify_household_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender text;
begin
  select username into v_sender from public.player_profiles where user_id = new.author_id;

  insert into public.notifications (user_id, household_id, type, title, body, data)
  select hm.user_id,
         new.household_id,
         case when new.recipient_id is null then 'household_message' else 'direct_message' end,
         coalesce(v_sender, 'A housemate') || case when new.recipient_id is null then ' sent a household message' else ' sent you a message' end,
         left(new.body, 240),
         jsonb_build_object(
           'message_id', new.id,
           'household_id', new.household_id,
           'type', case when new.recipient_id is null then 'household_message' else 'direct_message' end,
           'destination', '/house/' || new.household_id || '/messages'
         )
  from public.household_members hm
  where hm.household_id = new.household_id
    and hm.user_id <> new.author_id
    and (new.recipient_id is null or hm.user_id = new.recipient_id);

  return new;
end;
$$;

drop trigger if exists household_message_notification on public.household_messages;
create trigger household_message_notification
after insert on public.household_messages
for each row execute function public.notify_household_message();

notify pgrst, 'reload schema';

commit;
