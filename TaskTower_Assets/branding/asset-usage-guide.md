# Asset usage guide

- SVG is the source of truth; PNG is a delivery export.
- Preserve all SVG viewBoxes and never stretch characters non-uniformly.
- Backgrounds may crop with `object-fit: cover`; logos and characters may not.
- Decorative effects should use `aria-hidden="true"`.
- Names are lowercase, kebab-case and semantic.
- Copy this folder to `src/assets/tasktower` or expose it from `public/tasktower`.