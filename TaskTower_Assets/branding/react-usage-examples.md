# React usage examples

## Public URL

```jsx
<img src="/tasktower/characters/idle/outfit-purple.svg" alt="Your TaskTower character" />
```

## Vite source import

```jsx
import towerUrl from './assets/tasktower/tower/tower-split-full.svg'
export function Tower() { return <img src={towerUrl} alt="Monthly split tower" /> }
```

## SVGR component (optional)

```jsx
import Character from './assets/tasktower/characters/idle/character-base-neutral.svg?react'
export function Player() { return <Character className="h-40 w-auto" aria-label="Player" /> }
```

## Theme tokens

```js
import tokens from './assets/tasktower/branding/colour-tokens.json' with { type: 'json' }
document.documentElement.style.setProperty('--tt-primary', tokens.color.purple)
```

## Celebration overlay

```jsx
{celebrating && <img aria-hidden src="/tasktower/effects/confetti.svg" className="pointer-events-none absolute inset-0" />}
```

Use the five climbing frames as CSS backgrounds or timed React state. For reduced motion, render frame 05 only.