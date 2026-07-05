-- Replace seeded client-only household features with persistent, RLS-protected data.
-- Older TaskTower migrations created communication tables with a different shape.
-- Preserve those tables in a private legacy schema before creating the canonical live schema.

begin;

create schema if not exists tasktower_legacy;
revoke all on schema tasktower_legacy from public, anon, authenticated;

do $$
begin
  if to_regclass('public.household_shopping_items') is not null and (
    exists (
      select 1
      from unnest(array['id','household_id','name','detail','category','state','created_by','purchased_by','purchased_at','created_at','updated_at']) expected(column_name)
      where not exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'household_shopping_items'
          and c.column_name = expected.column_name
      )
    )
    or exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'household_shopping_items'
        and c.is_nullable = 'NO'
        and c.column_default is null
        and c.column_name <> all(array['household_id','name','created_by'])
    )
  ) then
    if to_regclass('tasktower_legacy.household_shopping_items_pre_live') is not null then
      raise exception 'A legacy household_shopping_items backup already exists; inspect tasktower_legacy before retrying.';
    end if;
    alter table public.household_shopping_items set schema tasktower_legacy;
    alter table tasktower_legacy.household_shopping_items rename to household_shopping_items_pre_live;
  end if;

  if to_regclass('public.household_messages') is not null and (
    exists (
      select 1
      from unnest(array['id','household_id','author_id','body','created_at']) expected(column_name)
      where not exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'household_messages'
          and c.column_name = expected.column_name
      )
    )
    or exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'household_messages'
        and c.is_nullable = 'NO'
        and c.column_default is null
        and c.column_name <> all(array['household_id','author_id','body'])
    )
  ) then
    if to_regclass('tasktower_legacy.household_messages_pre_live') is not null then
      raise exception 'A legacy household_messages backup already exists; inspect tasktower_legacy before retrying.';
    end if;
    alter table public.household_messages set schema tasktower_legacy;
    alter table tasktower_legacy.household_messages rename to household_messages_pre_live;
  end if;

  if to_regclass('public.household_notices') is not null and (
    exists (
      select 1
      from unnest(array['id','household_id','author_id','title','body','priority','expires_at','created_at','updated_at']) expected(column_name)
      where not exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = 'household_notices'
          and c.column_name = expected.column_name
      )
    )
    or exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'household_notices'
        and c.is_nullable = 'NO'
        and c.column_default is null
        and c.column_name <> all(array['household_id','author_id','title','body'])
    )
  ) then
    if to_regclass('tasktower_legacy.household_notices_pre_live') is not null then
      raise exception 'A legacy household_notices backup already exists; inspect tasktower_legacy before retrying.';
    end if;
    alter table public.household_notices set schema tasktower_legacy;
    alter table tasktower_legacy.household_notices rename to household_notices_pre_live;
  end if;
end;
$$;

create table if not exists public.household_shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  detail text not null default '',
  category text not null default 'General' check (char_length(category) between 1 and 60),
  state text not null default 'list' check (state in ('low', 'out', 'list')),
  created_by uuid not null references auth.users(id) on delete restrict,
  purchased_by uuid references auth.users(id) on delete set null,
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.household_notices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists household_shopping_items_house_idx
  on public.household_shopping_items(household_id, state, created_at desc);
create index if not exists household_messages_house_idx
  on public.household_messages(household_id, created_at desc);
create index if not exists household_notices_house_idx
  on public.household_notices(household_id, created_at desc);
create index if not exists household_notices_expiry_idx
  on public.household_notices(household_id, expires_at)
  where expires_at is not null;

alter table public.household_shopping_items enable row level security;
alter table public.household_messages enable row level security;
alter table public.household_notices enable row level security;

revoke all on public.household_shopping_items from anon;
revoke all on public.household_messages from anon;
revoke all on public.household_notices from anon;
grant select, insert, update, delete on public.household_shopping_items to authenticated;
grant select, insert, delete on public.household_messages to authenticated;
grant select, insert, update, delete on public.household_notices to authenticated;

drop policy if exists "members read household shopping" on public.household_shopping_items;
create policy "members read household shopping"
on public.household_shopping_items for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists "members add household shopping" on public.household_shopping_items;
create policy "members add household shopping"
on public.household_shopping_items for insert to authenticated
with check (public.is_household_member(household_id) and created_by = auth.uid());

drop policy if exists "members update household shopping" on public.household_shopping_items;
create policy "members update household shopping"
on public.household_shopping_items for update to authenticated
using (public.is_household_member(household_id))
with check (
  public.is_household_member(household_id)
  and (purchased_by is null or purchased_by = auth.uid() or public.is_household_owner(household_id))
);

drop policy if exists "members delete household shopping" on public.household_shopping_items;
create policy "members delete household shopping"
on public.household_shopping_items for delete to authenticated
using (public.is_household_member(household_id));

drop policy if exists "members read household messages" on public.household_messages;
create policy "members read household messages"
on public.household_messages for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists "members send household messages" on public.household_messages;
create policy "members send household messages"
on public.household_messages for insert to authenticated
with check (public.is_household_member(household_id) and author_id = auth.uid());

drop policy if exists "authors or owners delete household messages" on public.household_messages;
create policy "authors or owners delete household messages"
on public.household_messages for delete to authenticated
using (author_id = auth.uid() or public.is_household_owner(household_id));

drop policy if exists "members read household notices" on public.household_notices;
create policy "members read household notices"
on public.household_notices for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists "members create household notices" on public.household_notices;
create policy "members create household notices"
on public.household_notices for insert to authenticated
with check (public.is_household_member(household_id) and author_id = auth.uid());

drop policy if exists "authors or owners update household notices" on public.household_notices;
create policy "authors or owners update household notices"
on public.household_notices for update to authenticated
using (author_id = auth.uid() or public.is_household_owner(household_id))
with check (public.is_household_member(household_id) and (author_id = auth.uid() or public.is_household_owner(household_id)));

drop policy if exists "authors or owners delete household notices" on public.household_notices;
create policy "authors or owners delete household notices"
on public.household_notices for delete to authenticated
using (author_id = auth.uid() or public.is_household_owner(household_id));

drop trigger if exists household_shopping_items_updated on public.household_shopping_items;
create trigger household_shopping_items_updated
before update on public.household_shopping_items
for each row execute function public.set_updated_at();

drop trigger if exists household_notices_updated on public.household_notices;
create trigger household_notices_updated
before update on public.household_notices
for each row execute function public.set_updated_at();

do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['households', 'player_profiles', 'household_shopping_items', 'household_messages', 'household_notices']
    loop
      if not exists (
        select 1
        from pg_publication_tables
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
