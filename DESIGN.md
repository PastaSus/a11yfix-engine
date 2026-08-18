# Darkhouse — DESIGN.md

Locked design decisions for the Darkhouse web app. Read before editing any UI.

## Register

- **product-app** — a scan/audit tool surface (no marketing/landing page).
- Redesign mode: **overhaul** — the interaction layer (labels, aria-live, focus
  rings, stepper, retry/error states) is already honest and stays untouched.
  The overhaul targets the *aesthetic* layer only: fonts, color system,
  elevation, radius, motion, and brand treatment.

## Anchor

- Structure/rhythm anchored to **Linear-calm × Stripe-Dashboard precision**
  (a developer tool, so dev-tool anchors are appropriate).
- Distinctive character comes from **type + hue**, not decoration: warm paper
  neutrals instead of cool slate, a deep evergreen accent instead of indigo,
  and Space Grotesk display faces instead of Inter.

## Tokens

All color in OKLCH. One hue family for brand (evergreen ~160°), one for
neutrals (warm stone ~85°), severity ramps kept semantic.

| Token (light / dark) | Value |
|---|---|
| surface / background | `oklch(0.973 0.006 85)` / `oklch(0.175 0.009 85)` |
| surface-container | `oklch(0.952 0.008 85)` / `oklch(0.22 0.01 85)` |
| surface-container-high | `oklch(0.917 0.009 85)` / `oklch(0.275 0.012 85)` |
| on-surface | `oklch(0.235 0.018 85)` / `oklch(0.90 0.01 85)` |
| on-surface-variant | `oklch(0.46 0.015 85)` / `oklch(0.72 0.012 85)` |
| outline | `oklch(0.63 0.012 85)` / `oklch(0.60 0.012 85)` |
| primary | `oklch(0.42 0.09 160)` / `oklch(0.72 0.09 160)` |
| on-primary | `oklch(0.99 0.003 160)` / `oklch(0.22 0.03 160)` |
| primary-container | `oklch(0.90 0.04 160)` / `oklch(0.30 0.07 160)` |
| on-primary-container | `oklch(0.28 0.07 160)` / `oklch(0.92 0.04 160)` |

Severity: critical ≈ red ~27°, moderate ≈ amber ~65°, minor ≈ warm neutral,
conforming ≈ cool teal ~175° (kept distinct from evergreen). Containers are
the pale tints; `on-*` are the deep tones. Success ≈ conforming, warning ≈
moderate, error ≈ critical.

Code surface (diff viewer, dark in both themes):
- code-bg `oklch(0.16 0.01 85)`, code-surface `oklch(0.21 0.012 85)`,
  code-fg `oklch(0.86 0.01 85)`, code-muted `oklch(0.62 0.015 85)`,
  code-border `oklch(0.30 0.012 85)`,
  code-add `oklch(0.68 0.12 150)`, code-del `oklch(0.60 0.18 25)`.
  Code-surface warning (the "Proposed, not applied" badge, always-dark):
  code-warn-border `oklch(0.64 0.12 65)`, code-warn-bg `oklch(0.28 0.05 65)`,
  code-warn-fg `oklch(0.83 0.11 70)` — the moderate ~65° hue tuned to read on
  the dark surface in both themes.

## Type

| Role | Face | Weight |
|---|---|---|
| Display (headings, wordmark) | **Space Grotesk** | 500 / 700 |
| Body | **Geist** | 400 / 500 / 600 |
| Code / identifiers / tabular | **Geist Mono** | 400 / 500 |

Loaded via `next/font/google`. No Inter, no system-sans fallback for the base
face. Weight contrast display (700) vs body (400) is intentional.

## Radius

- `sm` 6px — inputs, buttons, chips, stepper pills
- `md` 10px — cards, tables, panels
- `lg` 14px — the ready-report panel

## Elevation

- `card` — `0 1px 2px rgb(0 0 0 / 0.04)` (subtle panel line)
- `elevated` — `0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px rgb(0 0 0 / 0.06)`
  (ready-report panel, the primary "result" surface)

## Motion

- Durations: 120 / 200 / 320 ms. Ease: `cubic-bezier(0.2, 0, 0, 1)`.
- No bounce, no parallax. Every transition guarded by `prefers-reduced-motion`.

## Hard rules

- One design language everywhere: the dark code surface uses the code tokens
  above, never an off-theme Tailwind slate/emerald palette.
- No em dashes in UI copy. No emoji-as-icon (inline SVG only).
- Never `#000`/`#fff`; brand stays evergreen + warm paper, never indigo.
