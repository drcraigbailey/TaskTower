begin;

alter table public.push_tokens
  add column if not exists enabled boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update public.push_tokens
set enabled = true
where enabled is null;

drop trigger if exists push_tokens_updated on public.push_tokens;
create trigger push_tokens_updated
before update on public.push_tokens
for each row execute function public.set_updated_at();

create index if not exists push_tokens_enabled_android_user_idx
on public.push_tokens(user_id, last_seen_at desc)
where enabled and platform = 'android';

create index if not exists push_tokens_enabled_token_idx
on public.push_tokens(token)
where enabled;

notify pgrst, 'reload schema';

commit;
