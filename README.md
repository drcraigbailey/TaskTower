# Dwellio

Dwellio is an Android-first React household organiser for shared homes. It brings tasks, shopping, notices, messages, household activity and permissions into one calm workspace. The app includes a persistent local demo mode and switches to live Supabase data when environment variables are present.

## Included screens and flows

- Login, registration and email-confirmation handling
- Create or join a household with persistent active-house routing
- Household dashboard with red, amber and green task summaries
- Add, edit, assign, reorder, complete and delete tasks
- Quick-clean and full-clean tracking with configurable thresholds
- Shared shopping stock states and purchase workflow
- Household messages and persistent notices with acknowledgements
- Profile pictures and optional images on tasks, messages and notices
- Owner-controlled household member removal
- Household activity timeline and member contribution summaries
- Owner and admin settings with server-enforced member permissions
- Profile editing, light and dark themes, haptics and native push-token registration

## Project structure

```text
src/
  assets/       Dwellio branding and supplied artwork
  components/   shared shell, navigation and interface components
  context/      authentication, household state and demo/live data boundary
  data/         safe local demonstration data
  features/     dashboard, shopping, communication, activity and settings
  lib/          Supabase client, private media helpers and native push registration
  pages/        authentication, household creation and task flows
supabase/
  migrations/   schema, RPCs, storage, triggers, indexes, Realtime and RLS policies
resources/      source Android app icon and splash artwork
android/        generated Capacitor Android project and assets
```

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Without environment variables the app runs in demo mode. Use any email address and an eight-character password. Demo household changes are persisted in local storage.

## Connect Supabase

1. Create a Supabase project.
2. Apply every SQL file in `supabase/migrations` in timestamp order, or run `npx supabase db push`.
3. Copy `.env.example` to `.env` and add the project URL and public anon key.
4. In Supabase Auth, add your development and production redirect URLs.
5. Restart the Vite development server.

Required client values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Never place a Supabase service-role key or Firebase server credential in the app. The client uses the public anon key, while Row Level Security and security-definer RPC checks enforce household membership and permissions.

## Database migrations

Apply these in order:

1. `20260705000100_tasktower.sql` creates authentication profiles, households, membership, tasks, completions, notifications, push tokens and the core household RPCs.
2. `20260705000200_adult_household_hub.sql` adds rooms, categories, shopping, notices, messages, activity, household settings and the adult task fields.
3. `20260705000300_wire_household_features.sql` backfills settings, caps households at ten members, adds activity and notification triggers, and completes Realtime publication coverage.
4. `20260705000400_enforce_household_permissions.sql` enforces household feature and member permission switches in RLS and inside the task-completion RPC.
5. `20260705000500_persistent_media_and_member_management.sql` adds private household image storage, profile and content image fields, image access policies and owner-controlled member removal.

The live app expects all five migrations. Running only the first migrations leaves the redesigned household features without their required tables, functions, policies or private media bucket.

## Android

The existing Capacitor application ID remains `app.tasktower.home` so installed Android builds and Firebase configuration do not silently become a different application during the Dwellio rebrand.

```powershell
npm.cmd run android:sync
npm.cmd run android:open
```

To build a debug APK without opening Android Studio:

```powershell
npm.cmd run android:build
```

The source app icon and splash art are in `resources/`; generated Android density assets are in `android/app/src/main/res`.

## Native push notifications

Token permission and registration are implemented in `src/lib/pushNotifications.js`. To enable delivery:

1. Create a Firebase project whose Android package is `app.tasktower.home`.
2. Download `google-services.json` into `android/app/`.
3. Set `VITE_PUSH_NOTIFICATIONS_ENABLED=true` in `.env`. Leave it false until the Firebase file exists.
4. Build and sync again.
5. Add a Supabase Edge Function that reads recipient rows from `push_tokens` and sends through Firebase Cloud Messaging.
6. Store Firebase credentials and the Supabase service-role key as Edge Function secrets only.

The database creates notification records for task completions, shopping alerts, notices, household messages and new members. The client intentionally contains no server-side delivery credentials.

## Validation commands

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run android:sync
cd android
.\gradlew.bat assembleDebug
```

## Production handoff

Before Play Store release, add production Supabase values, Firebase delivery credentials, Android signing configuration, privacy-policy links and final store screenshots. Test registration confirmation, household invitations, each member role, permission changes, Realtime updates, private media access and push delivery on at least two physical devices.
