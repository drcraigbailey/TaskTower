begin;

alter table public.household_shopping_items
  drop constraint if exists household_shopping_items_state_check;

update public.household_shopping_items
set state = 'list_low'
where state = 'list';

alter table public.household_shopping_items
  add constraint household_shopping_items_state_check
  check (state in ('in_stock', 'low', 'out', 'list', 'list_low', 'list_out'));

create or replace function public.sync_low_stock_to_shopping_list()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.state not in ('low', 'out') or new.purchased_at is not null then
    return new;
  end if;

  insert into public.household_shopping_items (
    household_id,
    name,
    detail,
    category,
    state,
    created_by
  )
  select
    new.household_id,
    new.name,
    case
      when nullif(trim(new.detail), '') is not null then new.detail
      when new.state = 'out' then 'Auto-added because this is out'
      else 'Auto-added because this is running low'
    end,
    new.category,
    case when new.state = 'out' then 'list_out' else 'list_low' end,
    coalesce(auth.uid(), new.created_by)
  where not exists (
    select 1
    from public.household_shopping_items existing
    where existing.household_id = new.household_id
      and existing.state in ('list', 'list_low', 'list_out')
      and existing.purchased_at is null
      and lower(trim(existing.name)) = lower(trim(new.name))
      and lower(trim(existing.category)) = lower(trim(new.category))
  );

  return new;
end;
$$;

commit;
