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

Vercel Preview builds apply the additive chat migrations automatically to their newly provisioned Turso branch. For Production, back up its database and apply `node --env-file=.env.production-migration.local scripts/migrate-004.js` followed by `node --env-file=.env.production-migration.local scripts/migrate-005.js` before merging chat. Both migrations are safe to rerun. Signed-in players share one chat stream with plain text, clickable links, editable base and gear dice, character action rolls, and pushed rolls. Character actions fill the base count from the selected attribute and talent; players may adjust it before rolling. The Roll dialog remains open after rolling so players can push. Download Log opens a date-range dialog and downloads a text file covering inclusive UTC dates.

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

## World map prototype

After backing up each existing environment's database, apply the additive world migration with `node --env-file=<verified-development-env-file> scripts/migrate-006.js` for the intended local/development database. Apply it separately to Production with `node --env-file=.env.production-migration.local scripts/migrate-006.js` before deploying this feature. Confirm each environment file points to the intended database. Preview builds apply the migration automatically to their isolated database. The migration can be rerun and preserves existing characters.

For databases seeded before the Choir's parent was corrected, run `node --env-file=<verified-environment-file> scripts/migrate-007.js` against the intended database. Confirm the environment file's target first. Preview builds apply this correction automatically. It changes only the original Choir sample while its parent is still the Star Map.

Before deploying the three-state location access UI and API against an existing database, apply `node --env-file=<verified-environment-file> scripts/migrate-008.js` to that database. It preserves legacy hidden locations as Invisible and can be rerun. Preview builds apply it automatically.

The prototype adds a small sample journey, persistent PC positions, connected Settlements, Dioramas, and Delves, room fog, GM pulls, and simple location creation and art upload. The GM palette and room-square editor remain later work; see `docs/MAP-DESIGN.md`.

For a quick local UI preview without database credentials, `npm run dev:local` starts an in-memory campaign at `http://127.0.0.1:3000`. Register with invitation code `local-preview-only`. All preview data disappears when the process stops; use the Turso-backed setup above for persistent development.

The local preview seeds six Ship City districts as Hubs: Aluminum Bay, the Chasm, Cave Gardens, Turbine Halls, Hull Town, and the Inner Sanctum. Their selected inner locations include Vistas, restricted thresholds, and three Explorables. The Inbetween and Serpentine remain Points of Interest on the main city map. Some playable locations are original interpretations rather than named book sites: the Seed Archive, Hydroponic Terraces, Mosaicists' Walk, Service Gallery, and Chain Walks. Every Hub, Vista, and Explorable in these six districts has generated watercolor art. The seed removes only the original sample markers from Ship City's map and is limited to the in-memory local preview. `scripts/seed-ship-city-slice.js` must not be run against a shared campaign database without reviewing existing locations and character positions first.

Location cards add an optional one-line impression, an optional attributed quote, and a separately uploaded illustration. Existing descriptions remain valid. Migration `scripts/migrate-009.js` adds these fields and the card image table without changing existing locations; it runs automatically only for the isolated Preview database. Any later deployment against a persistent database requires applying it to the intended target before deploying the new API.
