# Dwellio adult household app

## Product direction

Dwellio is structured as a calm household operations hub under the tagline “Your home, organised.” The primary navigation is Home, Tasks, Shopping, Messages and Settings. Tower racing, rooftop winners and game settings are no longer part of the primary route tree.

## Implemented UI

- Adult authentication and household hub
- Household dashboard with red/amber/green task summaries
- Existing task list, details, quick-clean and full-clean actions in the new visual system
- Shopping states for running low, out and shopping list
- Separate household messages and persistent notices
- Household contribution and activity summaries
- Household and account settings shells
- Fixed mobile bottom navigation
- Light and dark modes
- Reduced-motion support and text-plus-icon statuses

## Data ownership

Existing authentication, household, task, completion, notification, push and realtime paths remain in place. The Shopping, Notices, Messages and Activity screens currently use local demonstration data in `src/data/adultDemoData.js`.

Apply `supabase/migrations/002_adult_household_hub.sql` before replacing that demo data with Supabase queries. It adds the adult household tables, extended task fields, roles, indexes, RLS and Realtime publication entries without deleting existing task data.

## Feature structure

```text
src/
  components/adult/
  features/
    activity/
    communication/
    dashboard/
    households/
    settings/
    shopping/
```

Legacy tower components remain in the source tree temporarily for safe migration history, but their routes are removed. They can be deleted after production data and Android regression testing are complete.
