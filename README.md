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

Profiles can be created with a shared invitation code and signed into with a name and password. Players can create and manage their own PCs; GMs can see all characters, filter PCs and NPCs, and create NPCs. Character records and two optional images are saved in Turso. Detailed rules automation and GM map tools remain future work.

The character editor has Profile, Abilities, Condition, and Gear tabs. The shared Crew Sheet has Crew Info, Maneuvers, Bird, Rover, and Shuttle tabs. Crew Info holds five character roles and a shared portrait; Bird has its own portrait, appearance, description, and a larger Powers field. Maneuvers are individually addable and removable, each with a name and multi-line description. Existing single-line maneuvers appear as names with empty descriptions. Signed-in players can edit the crew record; a player may assign only their own PC to a role, while the GM may assign any PC. The Crew Sheet refreshes every four seconds while open and rejects stale writes.

## Run locally

The persistent version needs a Turso database and Vercel Functions. Install dependencies with `npm install`, copy `.env.example` to `.env.local`, and set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `REGISTRATION_INVITE_CODE`. Apply `db/001_initial.sql` to that database with `node --env-file=.env.local scripts/migrate.js`. Run `npx vercel dev` from the repository root to serve the static map and API together. `npm run check` and `npm test` verify source syntax and the account/character flow locally.

For an existing database, back it up and apply the additive character/crew migration with `node --env-file=.env.local scripts/migrate-002.js` **before deploying this version**. The migration can be rerun safely and preserves existing characters. Confirm the environment file points to the intended database before running it. Preview and Production require separate runs against their own databases; never use a Production credential for Preview testing.
Apply the additive shared-portrait migration with `node --env-file=.env.local scripts/migrate-003.js` before deploying the tabbed Crew Sheet. Run it separately for each intended database; it is safe to rerun.

Vercel Preview builds apply the additive chat migrations automatically to their newly provisioned Turso branch. For Production, back up its database and apply `node --env-file=.env.production-migration.local scripts/migrate-004.js` followed by `node --env-file=.env.production-migration.local scripts/migrate-005.js` before merging chat. Both migrations are safe to rerun. Signed-in players share one chat stream with plain text, clickable links, configurable base and gear dice, character action rolls, and pushed rolls. The Roll dialog remains open after rolling so players can push. Download Log opens a date-range dialog and downloads a text file covering inclusive UTC dates.

The two rules PDFs in `gamerules/` remain local and are ignored by Git. Do not commit them or any `.env` file. For Preview and Production, configure separate Turso databases and the three environment variables in Vercel before deploying. Apply the schema to each database once. See `docs/ARCHITECTURE.md` for the data and authorization model.

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
