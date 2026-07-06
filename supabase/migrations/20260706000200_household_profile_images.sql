-- Add a private household picture alongside the existing profile-picture media support.

begin;

alter table public.households
  add column if not exists image_path text;

drop policy if exists "owners upload household pictures" on storage.objects;
create policy "owners upload household pictures"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'household-media'
  and (storage.foldername(name))[1] = 'households'
  and (storage.foldername(name))[3] = 'profile'
  and public.storage_path_uuid(name, 4) = auth.uid()
  and public.is_household_owner(public.storage_path_uuid(name, 2))
);

drop policy if exists "owners update household pictures" on storage.objects;
create policy "owners update household pictures"
on storage.objects for update to authenticated
using (
  bucket_id = 'household-media'
  and (storage.foldername(name))[1] = 'households'
  and (storage.foldername(name))[3] = 'profile'
  and public.is_household_owner(public.storage_path_uuid(name, 2))
)
with check (
  bucket_id = 'household-media'
  and (storage.foldername(name))[1] = 'households'
  and (storage.foldername(name))[3] = 'profile'
  and public.storage_path_uuid(name, 4) = auth.uid()
  and public.is_household_owner(public.storage_path_uuid(name, 2))
);

drop policy if exists "owners delete household pictures" on storage.objects;
create policy "owners delete household pictures"
on storage.objects for delete to authenticated
using (
  bucket_id = 'household-media'
  and (storage.foldername(name))[1] = 'households'
  and (storage.foldername(name))[3] = 'profile'
  and public.is_household_owner(public.storage_path_uuid(name, 2))
);

commit;
