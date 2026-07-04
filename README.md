# TaskTower

TaskTower is an Android-first React app that turns shared chores into a friendly monthly tower race. It follows the supplied cosy pastel concept boards and includes a complete local demo so the interface can be explored before Supabase is connected.

## Included screens

- Login and registration
- Main menu with Add House, Join House, and Settings only
- Add/join house flows with persistent active-house routing
- House hub with members, streak, and split-tower snapshot
- Shared chore dashboard with status filters and reordering
- Add, edit, delete, quick-clean, and full-clean flows
- Zoomed split-tower race, leaderboard, and winner screen
- Personal avatar and celebration settings
- Shared household and game settings
- In-app notification centre and native push-token registration
- Light and dark themes, haptics, loading, empty, success, and error states

## Project structure

```text
src/
  assets/       generated splash artwork
  components/   logo, character, tower, headers, navigation
  context/      app state, persistence, demo/live service boundary
  data/         safe local demo data
  lib/          Supabase client and native push registration
  pages/        auth, menu, house, chores, tower, settings
supabase/
  migrations/   full schema, RPCs, indexes, triggers and RLS
resources/      source app icon and splash artwork
android/        generated Capacitor Android project and assets
```

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Without environment variables the app runs in demo mode. Use any email and an eight-character password.

## Connect Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/001_tasktower.sql` in the SQL editor (or use `supabase db push`).
3. Copy `.env.example` to `.env` and add the project URL and public anon key.
4. In Supabase Auth, add your development and production redirect URLs.
5. Restart the Vite development server.

Required client values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Never place a Supabase service-role key or Firebase server credential in the app. RLS is enabled on every application table, and all household data policies check membership.

## Database migration

The migration creates:

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

It also adds `create_house`, `join_house`, `leave_house`, and atomic `complete_chore` RPCs; profile and notification triggers; indexes; RLS policies; and Realtime publication for shared household state.

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

The source app icon and splash art are in `resources/`; generated Android density assets are already in `android/app/src/main/res`.

## Native push notifications

Token permission and registration are implemented in `src/lib/pushNotifications.js`. To enable delivery:

1. Create a Firebase project whose Android package is `app.tasktower.home`.
2. Download `google-services.json` into `android/app/`.
3. Set `VITE_PUSH_NOTIFICATIONS_ENABLED=true` in `.env`. Leave it false until the Firebase file exists, otherwise Firebase Messaging may terminate the Android activity during login.
4. Build/sync again. The Capacitor Android project applies the Google Services plugin automatically when that file exists.
5. Create a Supabase Edge Function that reads recipient rows from `push_tokens`, sends through Firebase Cloud Messaging, and records the matching row in `notifications`.
6. Store Firebase credentials and the Supabase service-role key as Edge Function secrets only.

The SQL migration stores notification history and device tokens. The client intentionally does not include server-side sending credentials.

## Artwork and icons

- Original TaskTower splash illustration and app icon were generated for this project from the supplied concept boards.
- Characters, tower game view, category treatments, progress graphics, confetti, and empty states are lightweight CSS/HTML components.
- Interface icons use the free MIT-licensed Lucide icon set.

## Validation commands

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run android:sync
cd android
.\gradlew.bat assembleDebug
```

## Production handoff

Before Play Store release, add real Supabase project values, Firebase delivery credentials, signing configuration, privacy-policy links, final store screenshots, and run a physical-device notification test. Monthly due-soon/overdue scheduling should be driven by a Supabase scheduled Edge Function using the existing notification and chore data.
