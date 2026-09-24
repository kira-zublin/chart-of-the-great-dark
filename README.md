# Chart of the Great Dark

Companion application for a private Coriolis: The Great Dark campaign, built around the original star-chart prototype.

This repository is intentionally independent from the existing Alien / Astrolabe Navigation project so work here cannot affect that game's deployment or stored campaign data.

## Current prototype

- Animated star-chart background
- Three test delve markers with distinct astrolabe-style glyphs
- Hover and selected-state animation
- Animated Slipstream route tracing
- Expedition dossier panel
- Lightweight canvas star/dust particles
- Reduced-motion support
- Local image assets for the chart

## First persistent feature

Profiles can be created with a shared invitation code and signed into with a name and password. Players can create and manage their own PCs; GMs can see all characters, filter PCs and NPCs, and create NPCs. Character identity, description, six core attributes, and two optional images are saved in Postgres. The rest of the character sheet and GM map tools are planned for later iterations.

## Run locally

The persistent version needs a Postgres database and Vercel Functions. Install dependencies with `npm install`, copy `.env.example` to `.env.local`, and set `DATABASE_URL` and `REGISTRATION_INVITE_CODE`. Apply `db/001_initial.sql` to that database. Run `npx vercel dev` from the repository root to serve the static map and API together. `npm run check` and `npm test` verify source syntax and core validation.

The two rules PDFs in `gamerules/` remain local and are ignored by Git. Do not commit them or any `.env` file. For Preview and Production, configure separate Postgres databases and the two environment variables in Vercel before deploying. See `docs/ARCHITECTURE.md` for the data and authorization model.

## Planned direction

The next iterations can add:
- painterly / watercolor map assets
- GM create/edit/delete workflows
- player visibility controls
- additional persistent campaign data
- splash art per delve
- saved map positions and routes
- separate GM/player views
- richer Bird / Garuda UI integration

The current delve names and details are prototype content only.
