# TaskTower

TaskTower is an Android-first React app that turns shared household jobs into a friendly monthly tower race. It uses Supabase for real accounts, household membership, shared tasks, shopping, messages, notices, activity and live updates.

## Included screens

- Login and registration using Supabase Auth
- Household switcher with create and join flows
- Persistent active-house routing across web and Android
- House dashboard with members, shared task status and recent activity
- Add, edit, delete, reorder, quick-clean and full-clean task flows
- Persistent shopping list and household stock states
- Persistent household messages and notices
- Household and profile settings saved to Supabase
- In-app notifications and native push-token registration
- Light and dark themes, haptics, loading, empty, success and error states

## Project structure

```text
src/
  assets/       generated splash artwork
  components/   logo, character, tower, headers and navigation
  context/      authenticated app state and Supabase persistence
  data/         static UI metadata and safe defaults
  features/     household dashboard, shopping, communication and settings
  lib/          Supabase client, data services and native push registration
  pages/        auth, household creation and task screens
supabase/
  migrations/   schema, RPCs, indexes, triggers, RLS and shared feature tables
resources/      source app icon and splash artwork
android/        generated Capacitor Android project and assets
```

## Connect Supabase

This app does not include demo accounts or a local data fallback. Supabase must be configured before login, registration or household changes can be used.

1. Create a Supabase project.
2. Link the checkout once with `npx supabase link --project-ref YOUR_PROJECT_REF`, then apply every migration with `npx supabase db push`.
3. Copy `.env.example` to `.env` and add the project URL and public anon key.
4. In Supabase Auth, add your development and production redirect URLs.
5. Restart the Vite development server after changing environment values.

Required client values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
VITE_AUTH_REDIRECT_URL=http://localhost:5173/
```

For local registration, add both `http://localhost:5173/**` and `http://127.0.0.1:5173/**` under Supabase **Authentication > URL Configuration > Redirect URLs**. Set the Site URL to `http://localhost:5173` while developing. Production and Android builds should set `VITE_AUTH_REDIRECT_URL` to the hosted HTTPS callback that is also listed in Supabase.

Never place a Supabase service-role key or Firebase server credential in the app. The public anon key is expected in the client; Row Level Security is the data boundary.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

## Database

The migrations create and secure:

- `player_profiles`
- `households`
- `household_members`
- `household_join_codes`
- `chores`
- `chore_completions`
- `chore_settings`
- `monthly_game_state`
- `notifications`
- `push_tokens`
- `household_shopping_items`
- `household_messages`
- `household_notices`

The database also provides `create_house`, `join_house`, `leave_house` and atomic `complete_chore` RPCs. Household data is protected by membership-aware RLS policies and the live tables are added to Supabase Realtime.

## Android

The Capacitor application ID is `app.tasktower.home`.

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
3. Set `VITE_PUSH_NOTIFICATIONS_ENABLED=true` in `.env` only after that file exists.
4. Build and sync again.
5. Create a Supabase Edge Function that reads recipient rows from `push_tokens`, sends through Firebase Cloud Messaging and records the matching row in `notifications`.
6. Store Firebase credentials and the Supabase service-role key as Edge Function secrets only.

## Validation commands

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run android:sync
cd android
.\gradlew.bat assembleDebug
```

## Production handoff

Before Play Store release, add production Supabase and Firebase values, signing configuration, privacy-policy links and final store assets. Run a physical-device test covering registration, email confirmation, creating and switching households, cross-device Realtime updates, offline recovery and push delivery.
