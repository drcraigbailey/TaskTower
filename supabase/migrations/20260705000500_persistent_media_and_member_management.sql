-- Persistent household media, profile pictures and owner-controlled member removal.
-- Apply after 20260705000400_enforce_household_permissions.sql.

begin;
alter table public.player_profiles
  add column if not exists avatar_path text;
alter table public.chores
  add column if not exists image_path text;
alter table public.household_notices
  add column if not exists image_path text;
alter table public.household_messages
  add column if not exists image_path text;
alter table public.household_messages
  alter column body set default '';
alter table public.household_messages
  drop constraint if exists household_messages_body_check;
alter table public.household_messages
  add constraint household_messages_body_check check (
    (char_length(body) between 1 and 4000)
    or (image_path is not null and char_length(body) <= 4000)
  );
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'household-media',
  'household-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create or replace function public.storage_path_uuid(p_name text, p_index integer)
returns uuid
language plpgsql
immutable
set search_path = public, storage
as $$
declare
  v_value text;
begin
  v_value := (storage.foldername(p_name))[p_index];
  if v_value is null then return null; end if;
  return v_value::uuid;
exception when others then
  return null;
end;
$$;
create or replace function public.can_view_profile_media(
  p_profile_user_id uuid,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_profile_user_id = p_viewer_user_id
    or exists (
      select 1
      from public.household_members mine
      join public.household_members theirs
        on theirs.household_id = mine.household_id
      where mine.user_id = p_viewer_user_id
        and theirs.user_id = p_profile_user_id
    );
$$;
revoke all on function public.storage_path_uuid(text, integer) from public;
revoke all on function public.can_view_profile_media(uuid, uuid) from public;
grant execute on function public.storage_path_uuid(text, integer) to authenticated;
grant execute on function public.can_view_profile_media(uuid, uuid) to authenticated;
drop policy if exists "household members read household media" on storage.objects;
drop policy if exists "users upload household media" on storage.objects;
drop policy if exists "users update household media" on storage.objects;
drop policy if exists "users delete household media" on storage.objects;
create policy "household members read household media"
on storage.objects for select to authenticated
using (
  bucket_id = 'household-media'
  and (
    (
      (storage.foldername(name))[1] = 'profiles'
      and public.can_view_profile_media(public.storage_path_uuid(name, 2))
    )
    or (
      (storage.foldername(name))[1] = 'households'
      and public.is_household_member(public.storage_path_uuid(name, 2))
    )
  )
);
create policy "users upload household media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'household-media'
  and (
    (
      (storage.foldername(name))[1] = 'profiles'
      and public.storage_path_uuid(name, 2) = auth.uid()
    )
    or (
      (storage.foldername(name))[1] = 'households'
      and (storage.foldername(name))[3] in ('tasks', 'notices', 'messages')
      and public.is_household_member(public.storage_path_uuid(name, 2))
      and public.storage_path_uuid(name, 4) = auth.uid()
    )
  )
);
create policy "users update household media"
on storage.objects for update to authenticated
using (
  bucket_id = 'household-media'
  and (
    (
      (storage.foldername(name))[1] = 'profiles'
      and public.storage_path_uuid(name, 2) = auth.uid()
    )
    or (
      (storage.foldername(name))[1] = 'households'
      and public.is_household_member(public.storage_path_uuid(name, 2))
      and (
        public.storage_path_uuid(name, 4) = auth.uid()
        or public.is_household_admin(public.storage_path_uuid(name, 2))
      )
    )
  )
)
with check (
  bucket_id = 'household-media'
  and (
    (
      (storage.foldername(name))[1] = 'profiles'
      and public.storage_path_uuid(name, 2) = auth.uid()
    )
    or (
      (storage.foldername(name))[1] = 'households'
      and public.is_household_member(public.storage_path_uuid(name, 2))
      and (
        public.storage_path_uuid(name, 4) = auth.uid()
        or public.is_household_admin(public.storage_path_uuid(name, 2))
      )
    )
  )
);
create policy "users delete household media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'household-media'
  and (
    (
      (storage.foldername(name))[1] = 'profiles'
      and public.storage_path_uuid(name, 2) = auth.uid()
    )
    or (
      (storage.foldername(name))[1] = 'households'
      and public.is_household_member(public.storage_path_uuid(name, 2))
      and (
        public.storage_path_uuid(name, 4) = auth.uid()
        or public.is_household_admin(public.storage_path_uuid(name, 2))
      )
    )
  )
);
create or replace function public.remove_household_member(
  p_household_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select owner_id into v_owner_id
  from public.households
  where id = p_household_id;

  if v_owner_id is null then
    raise exception 'Household not found';
  end if;

  if v_owner_id <> auth.uid() then
    raise exception 'Only the household owner can remove members';
  end if;

  if p_user_id = v_owner_id then
    raise exception 'The household owner cannot be removed';
  end if;

  if not public.is_household_member(p_household_id, p_user_id) then
    raise exception 'That person is not a member of this household';
  end if;

  select username into v_name
  from public.player_profiles
  where user_id = p_user_id;

  update public.chores
  set assigned_to = null,
      responsibility = 'shared'
  where household_id = p_household_id
    and assigned_to = p_user_id;

  delete from public.notifications
  where household_id = p_household_id
    and user_id = p_user_id;

  delete from public.household_members
  where household_id = p_household_id
    and user_id = p_user_id;

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
    'member_removed',
    'member',
    p_user_id,
    'removed a household member',
    jsonb_build_object(
      'subject_name', coalesce(v_name, 'Household member'),
      'tone', 'red'
    )
  );
end;
$$;
revoke all on function public.remove_household_member(uuid, uuid) from public;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
commit;
