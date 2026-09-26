# UI Guide

The interface should feel like a book of charts carried into the Great Dark: dark ink and weathered metal around watercolor art, with brass and gold used sparingly. The Coriolis rulebook's page design is the main reference (ornamental chapter rules, widely spaced capitals, painted art that bleeds off its frame). Supergiant's games are a secondary reference for restraint: controls stay quiet, and effort goes into a few moments such as arriving somewhere or rolling dice.

Readability comes first. Decoration must never hide interaction state, and every effect must have a static fallback.

## Where styles live

| File | Contents |
| --- | --- |
| `index.html` (inline `<style>`) | Base layout and component structure for the star chart, HUD, panels, chat and dialogs. |
| `world-ui.css` | Location views: headings, markers, grids, standups, the location card. |
| `ui-theme.css` | The visual-language layer: typeface, surfaces, dividers, buttons, tabs, fields, reveals, scene transitions and dice cards. Loaded last. |
| `scene-effects.js` | The ink-bloom transition between locations and drifting dust in scenes. |

Put new visual-language rules in `ui-theme.css` rather than restyling components one by one.

## Color

| Role | Value |
| --- | --- |
| Ink (page) | `#03070b`, `#080d12` |
| Panel | `#0c1419` to `#182025` |
| Paper text | `#ded2ae`; headings `#f1dfb8` / `#f4e6c1` |
| Muted text | `#978c72`, `#a99b78` |
| Gold (lines, ornaments) | `#cdb87d` |
| Brass (primary actions) | `#ddc287` → `#bf9f5e` → `#a2823f` |
| Rust (warnings, costs, warm wash) | `#a35f46`, `#d98a68` |
| Steel blue (cool wash) | `#718b9b` |
| Vista teal | `#9cc7c6` |

Panels carry a faint rust wash in one corner and a cool steel wash in the opposite corner. Keep new colors within this palette.

## Typography

- **Display:** Marcellus SC, self-hosted in `assets/fonts/` (SIL Open Font License; see `MARCELLUS-SC-OFL.txt`). Use it only for titles: panel and card headings, location headings, map labels, marker names and roll results. It sets lowercase as small capitals, so write titles in normal case. Letter-spacing is about `.05em`.
- **Body, forms and buttons:** Georgia.
- **Eyebrows and labels:** Georgia, uppercase, 9–11px, letter-spacing `.12em`–`.25em`.

## Ornaments

- **Divider:** any `.rule` element renders the book divider: a fading line broken by a small circle, a dot and a ringed dot on each side of the label. Use it for section breaks inside panels and cards.
- **Frame corners:** thin gold corner brackets (the `--corners` background layers in `ui-theme.css`) mark cards that matter: the sign-in card, location headings, location and star-chart dossiers, and dialogs. Don't add them to every box.
- **Grain:** surfaces layer `assets/ui/paper-grain.png`, a transparent pigment-grain tile, over their gradient.

## Controls

- **Buttons:** dark gradient with a hairline border. On hover the border warms, a soft glow appears and a gold line draws out from the centre. They press down 1px when clicked.
- **Primary actions** (`.primary-button`): brushed brass with a sheen that passes over on hover. Use one primary action per surface.
- **Tabs** (`role="tab"` in `.panel-tabs` and `.sheet-tabs`): text only. The active tab is brighter and has a gold line with a diamond beneath it.
- **Close buttons:** round, with a dashed ring that turns on hover.
- **Fields:** a faint box with a stronger bottom edge. On focus, a gold underline draws across. The keyboard focus outline stays.

## Map markers

Location markers on Hub maps are brass sigils with the name set directly on the painting, softened by a dark halo instead of a label box. Each kind has its own sigil and accent:

| Kind | Sigil | Accent |
| --- | --- | --- |
| Hub (`settlement`) | Compass rose | Gold |
| Explorable (`delve`) | Descending arch with steps | Rust |
| Vista (`diorama`) | Lens | Teal |
| Point of interest (`poi`) | Diamond in a dotted ring | Pale brass |

The sigils are SVG symbols in `index.html` (`#sigil-*`). On hover, focus or selection, lamplight spreads under the marker and the name is underlined. Restricted and invisible locations use grey accents.

## Motion

Motion runs only when `#app` has the `motion` class, which is set unless the device asks for reduced motion. `index.html` also disables all CSS animation and transitions under `prefers-reduced-motion`. Every effect must still read correctly without motion.

| Moment | Effect | Duration |
| --- | --- | --- |
| Entering a location | Dark ink spreads from the marker used to travel, and the new scene blooms in behind it through a watercolor mask (`assets/ui/watercolor-bloom-mask.png`) | ~1.3s |
| Returning to the star chart | The scene shrinks away through the same mask | ~0.85s |
| Opening a card or arriving | Title, tagline and text rise into place one after another | 0.7s, staggered by 0.1s |
| Location card art | Bleeds in, framed by a frayed watercolor edge (`assets/ui/watercolor-edge-mask.png`) | 1s |
| Hubs and Vistas | Up to 48 warm dust motes drift upward; they stop while the tab is hidden and never appear on Explorable grids | Continuous |
| New dice rolls in chat | Dice tumble in and settle on the server's result; sixes catch the light | ~0.6–1s |

Animate only `transform`, `opacity` and masks. Transitions run only when the viewed location changes, never on the one-second world refresh.

## Dice cards

Chat shows each roll as a card:

- **Base dice** are bone; **gear dice** are dark metal, after a thin divider.
- **A six** shows a star and a gold face. **A one** has rust pips, because a push turns base ones into Hope loss and gear ones into gear wear.
- The result line gives the successes. A push also shows its Hope loss and gear wear.

The card's visible parts are hidden from screen readers. A visually hidden sentence carries the same text used in chat exports. The dice values always come from the server; the tumble only presents them.

## Assets

UI assets live in `assets/ui/` and fonts in `assets/fonts/`. The watercolor masks and grain were generated procedurally for this app. Location art follows `docs/ART-DIRECTION.md`.
