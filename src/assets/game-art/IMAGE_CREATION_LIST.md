# TaskTower individual image production list

This folder is the app-facing raster art system. Keep source artwork at 2x size and export production WebP files from transparent PNG masters.

## Already available

- `brand/tasktower-wordmark.svg`
- `screens/main-menu/main-menu-day.webp` (temporary crop from the approved tower race scene)
- `screens/tower/tower-day.webp`
- `screens/chores/chores-teamwork.webp`
- `screens/states/winner-celebration.webp`
- `ui/chore-categories/chore-{kitchen,bathroom,laundry,living-room,outdoor,housework}.webp`

## Create: character poses

Transparent 1024 x 1536 PNG masters, exported to WebP. Use the same canvas, baseline and character scale for every pose.

- `characters/poses/yogi-idle.webp`
- `characters/poses/yogi-walk.webp`
- `characters/poses/yogi-climb.webp`
- `characters/poses/yogi-celebrate.webp`
- `characters/poses/yogi-sad.webp`
- `characters/poses/yogi-thinking.webp`
- `characters/poses/yogi-wave.webp`
- `characters/poses/yogi-holding-trophy.webp`

## Create: customisation portraits

Transparent 512 x 512 head-and-shoulders images with identical crop and lighting.

### Hair

- `characters/customisation/hair/hair-brown.webp`
- `characters/customisation/hair/hair-black.webp`
- `characters/customisation/hair/hair-blonde.webp`
- `characters/customisation/hair/hair-red.webp`
- `characters/customisation/hair/hair-curly.webp`
- `characters/customisation/hair/hair-spiky.webp`
- `characters/customisation/hair/hair-purple.webp`
- `characters/customisation/hair/hair-blue.webp`

### Skin tones

- `characters/customisation/skin-tones/skin-fair.webp`
- `characters/customisation/skin-tones/skin-light.webp`
- `characters/customisation/skin-tones/skin-medium.webp`
- `characters/customisation/skin-tones/skin-deep.webp`
- `characters/customisation/skin-tones/skin-dark.webp`

### Hoodie colours

- `characters/customisation/hoodies/hoodie-purple.webp`
- `characters/customisation/hoodies/hoodie-blue.webp`
- `characters/customisation/hoodies/hoodie-green.webp`
- `characters/customisation/hoodies/hoodie-yellow.webp`
- `characters/customisation/hoodies/hoodie-orange.webp`
- `characters/customisation/hoodies/hoodie-red.webp`
- `characters/customisation/hoodies/hoodie-pink.webp`

## Create: climbing animation

Transparent 1024 x 1536 frames. Lock the tower and character registration points so frames do not jump during playback.

- `characters/climbing/climb-00-start.webp`
- `characters/climbing/climb-01.webp`
- `characters/climbing/climb-02.webp`
- `characters/climbing/climb-03.webp`
- `characters/climbing/climb-04.webp`
- `characters/climbing/climb-05-top-celebrate.webp`

## Create: screen artwork

Portrait 1024 x 1536 WebP unless noted. Do not bake interface copy into artwork.

- `screens/main-menu/main-menu-background.webp`
- `screens/tower/tower-day.webp` (available; final polish optional)
- `screens/tower/tower-evening.webp`
- `screens/tower/tower-night.webp`
- `screens/house/house-page-background.webp`
- `screens/chores/chores-empty.webp`
- `screens/leaderboard/leaderboard-podium.webp`
- `screens/states/winner-celebration.webp` (available)
- `screens/states/loading-tower.webp`
- `screens/states/empty-join-house.webp`
- `screens/states/add-house.webp`

## Create only if the matching UI is added

- `ui/rewards/reward-coin.webp`
- `ui/rewards/reward-gem.webp`
- `ui/rewards/reward-star.webp`
- `ui/rewards/reward-trophy.webp`
- `ui/effects/confetti.webp`
- `ui/effects/sparkles.webp`
- `ui/effects/level-up-burst.webp`

## Art direction

- Friendly 2.5D storybook mobile-game rendering.
- Dark violet outlines, painterly highlights and warm glowing windows.
- Royal purple is primary; sky blue, warm gold and pink are supporting colours.
- Characters must retain the supplied face proportions and oversized expressive eyes.
- No watermarks, checkerboards, labels or UI text inside production artwork.

