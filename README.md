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

## Retiring the Choir prototype

The Choir Below and the Choir Depths were test delves and are no longer part of the campaign. Migration `scripts/migrate-011.js` removes both, with their links, art and room settings. Characters standing in either are returned to Ship City, and any location created beneath them moves up to Ship City. It is safe to rerun. Preview builds and `npm run dev:local` apply it automatically. Back up Production and run `node --env-file=.env.production-migration.local scripts/migrate-011.js` before merging.

## Retiring the Dockside Exchange

The Dockside Exchange was a test Vista inside Ship City. Migration `scripts/migrate-013.js` removes it with its links and art. Characters standing there return to Ship City, and it is safe to rerun. Preview builds and `npm run dev:local` apply it automatically. Back up Production and run `node --env-file=.env.production-migration.local scripts/migrate-013.js` before or after merging; the app works either way.

## Stand-up size

In a Vista, players can resize their own character's stand-up from 50% to 150% with the Stand-up size slider, and the GM can resize any character. The size is saved with the character's position, so everyone sees the same scene. Migration `scripts/migrate-012.js` adds the `standup_scale` column and is safe to rerun. Preview builds and `npm run dev:local` apply it automatically. Back up Production and run `node --env-file=.env.production-migration.local scripts/migrate-012.js` before merging.

## Stand-up flip and delve suit

Next to the size slider, **Flip** mirrors a character's stand-up so it faces the other way. The **Delve suit** checkbox swaps in the optional delve-suit stand-up uploaded in the Characters tab; it stays on across locations until the player unchecks it. Like the size, both settings are saved with the character's position and shared with every viewer, and the GM can change them for any character. Migration `scripts/migrate-014.js` adds the `standup_flipped` and `delve_suit` columns and a `delve_suit` image slot. The slot needs `character_images` rebuilt, which the migration does in a single write batch that copies every existing image. It is safe to rerun. Preview builds and `npm run dev:local` apply it automatically. Back up Production and run `node --env-file=.env.production-migration.local scripts/migrate-014.js` **before merging**, because the new map API reads the new columns.

## Area List and instanced areas

The GM's **Areas** tab lists every location grouped by type, with a search box. **Jump** opens a location for the GM only; nobody else's view or position changes. **Instance** makes a temporary copy of a Hub, Explorable, or Vista and jumps there. The copy keeps the original's title, description, art, grid, fog, and room settings, but has no markers, doors, or characters, so players cannot find it on their own; pull them in. Rename and rebuild it with the usual Mapping tools, and anything created inside a Hub instance is temporary too. Only the GM sees the **Instance** badge. The original is never changed.

Instances clean themselves up. Each map refresh marks an instance active while a character stands in it or someone is viewing it. Once one has been empty and unviewed for two hours (`INSTANCE_IDLE_SECONDS` in `lib/world.js`), the next map load removes it with its art and settings. **Delete instance** removes one at once and returns any characters there to the Star Map.

Migration `scripts/migrate-015.js` adds the `is_instance`, `instance_of`, and `instance_active_at` columns to `locations`. It is safe to rerun. Preview builds and `npm run dev:local` apply it automatically. Back up Production and run `node --env-file=.env.production-migration.local scripts/migrate-015.js` **before merging**; until then, creating locations fails.

## Vista dialog

In a Vista, chat lines appear in a visual-novel dialog box at the top of the scene, with the speaker's portrait and the text typing out letter by letter. It shows text lines from characters standing in that Vista and from the GM: a GM line with no character selected appears as italic narration, and a GM speaking as an NPC shows that NPC. Dice rolls and out-of-character lines (starting with `//`, `((`, or `ooc:`) stay in the chat log only. Lines that arrive together queue up; clicking the box finishes the current line or skips to the next. On entering a Vista the latest line appears in full. The × hides the box, leaving a **Show dialog** button; each browser remembers the choice. No migration is needed: chat messages now also report whether the GM sent them (`from_gm`).

## Jukebox

The GM uploads licensed MP3 tracks (up to 50 MB each) in the Music tab and plays one at a time for every signed-in profile. Audio files live in Vercel Blob; Turso stores track titles and the shared playback state. Uploads require `BLOB_READ_WRITE_TOKEN`, which Vercel adds when a Blob store is connected to the project; pull it into `.env.local` with `npx vercel env pull .env.local`. `npm run dev:local` reads only that token from `.env.local`, so local uploads go to the real Blob store while the database stays in memory. Without the token the Music tab explains that uploads are unavailable.

Migration `scripts/migrate-010.js` adds the `jukebox_tracks` and `jukebox_state` tables and is safe to rerun. Preview builds apply it automatically; back up Production and run `node --env-file=.env.production-migration.local scripts/migrate-010.js` before merging the jukebox.

The Music tab's **Volume for everyone** slider sets a shared level that multiplies with each player's own Sound volume, so the GM can even out tracks recorded at different loudness. It applies to whatever is playing and reaches players within a poll (about two seconds) without restarting the track. Migration `scripts/migrate-016.js` adds the `volume` column to `jukebox_state` and is safe to rerun. Preview builds and `npm run dev:local` apply it automatically. Back up Production and run `node --env-file=.env.production-migration.local scripts/migrate-016.js` **before merging**, because the jukebox API reads the new column.

### Rules reference

The Explorer sheet can show the rulebook's talent descriptions, and offer the critical injury, mental trauma and Blight manifestation tables when adding a card, plus rule tooltips on weapon and suit features. That text is not in the repository. Keep the extracted library at `gamerules/rules-library.json` (already ignored by Git) and load it with `node --env-file=<verified-environment-file> scripts/import-rules.js`. Each run replaces the whole reference with the file's contents; nobody edits it in the app. Without it, the sheet works as before with no descriptions. `npm run dev:local` imports the file automatically when it is present.

Migration `scripts/migrate-018.js` adds the `rules_entries` table. It is safe to rerun, and preview builds and `npm run dev:local` apply it automatically. The rules API returns an empty reference until it runs, so merging first is harmless; run it on Production, then the import, to turn the descriptions on.

### Crew sheet

The Crew tab draws on the book's crew rules: a delve formation of the five roles, a board of the 20 maneuvers, the Bird with its powers and **Command the Bird**, and spec plates for the rover and shuttle with upgrade slots. Learning, installing and awarding crew points save together with the change, and every change to crew points is kept in a history on the Crew tab.

Migration `scripts/migrate-019.js` adds the crew's engagement tracker and crew-point history, and lets the rules reference hold the crew's book text. It is safe to rerun. Preview builds and `npm run dev:local` apply it automatically. Back up Production and run `node --env-file=.env.production-migration.local scripts/migrate-019.js` **before merging**, then rerun `scripts/import-rules.js` so the maneuver, power, Losing Control and upgrade descriptions load. The crew API still saves changes before the migration runs, without history entries.

### Creature palette

The GM's Creatures tab lists palette entries by category with search and filters. Each entry opens a stat block (Ferocity, Health, Armor, attributes, description, containment protocol, abilities, behavior pattern and signature attacks, or an adversary's attributes, talents and gear), which the GM can edit, duplicate or delete. New creature adds the GM's own entries. To place creatures, open a Vista or Explorable and drag a palette row onto it, or choose **Place** (which also works on touch screens). Creatures appear as stand-ups in Vistas and as tokens in Explorables; large creatures cover 2 × 2 or 3 × 3 squares, and characters cannot move into squares a visible creature covers. The GM drags placed creatures to move them. Clicking one opens a control bar to hide it from players, resize or flip its stand-up, duplicate it or remove it. Players see visible creatures by name and cannot move them.

While the GM views a Vista or Explorable, the Creatures tab lists the creatures there. Each opens a sheet (also reached with **Sheet** on the map) to rename it, adjust its current Health, mark conditions (the six standard ones or any the GM names, such as Stunned), show its Health to players, hide it, or edit that creature's own stats without changing the palette entry. At 0 Health a creature is broken and turns grey. **Use** on a signature attack posts it to chat with its base and Blight dice rolled by the server; the GM chooses the attack, and the sheet marks the one used last because a creature never repeats it. **Speak as it in chat** (or **Speak as** on the map) makes the GM's chat lines come from the creature, with its picture in chat and the Vista dialog, until **Stop speaking as creature**. Players see a name plate under creature stand-ups, with a Health bar when the GM shows it. No migration is needed beyond 017.

Migration `scripts/migrate-017.js` adds the creature tables and the chat `creature_id` column. It is safe to rerun. Preview builds and `npm run dev:local` apply it automatically. Back up Production and run `node --env-file=.env.production-migration.local scripts/migrate-017.js` **before merging**, because the palette API reads the new tables.

The rulebook's creatures and adversaries are not in the repository. Keep the extracted library at `gamerules/creature-library.json` (already ignored by Git) and load it with `node --env-file=<verified-environment-file> scripts/import-creatures.js`. Rerunning it adds only missing entries and keeps the GM's edits; add `--overwrite` to restore book entries to the book's text. `npm run dev:local` imports the file automatically when it is present.

The 15 nonhuman book creatures have 256×256 portraits in `assets/creatures/` (about 15–24 KB each). After importing the rulebook entries, run `node --env-file=<verified-environment-file> scripts/import-creature-portraits.js --dry-run` to check the target, then rerun without `--dry-run` to store the images in the existing `creature_template_images` portrait slots. The importer matches filenames to `book_key`, leaves existing portraits alone, and supports `--overwrite` for a deliberate replacement. Local preview imports these portraits automatically after the rulebook library.

At 50 MB per track, the Hobby plan's 1 GB of Blob storage holds about twenty large tracks, and every listener downloads a track the first time it plays (a 50 MB track for five players is 250 MB of the 10 GB monthly transfer).

The browser upload helper is a committed bundle at `vendor/blob-client.js`, because the app loads browser modules without a bundler. After upgrading `@vercel/blob`, run `npm run build:vendor` and commit the result.

To publish the reviewed Ship City slice to an existing Production campaign, first verify `.env.production-migration.local` targets the Production database and differs from Preview. Run `node --env-file=.env.production-migration.local scripts/publish-ship-city.js status` to check for conflicting IDs and characters at the two retired sample markers. Then run `node --env-file=.env.production-migration.local scripts/publish-ship-city.js apply ../production-backups/ship-city-pre-release-<unique-timestamp>.sqlite`. The apply command creates and verifies a local SQLite backup before applying migrations 008/009 and inserting the city data in one transaction. It aborts if the target IDs already exist or if retiring the original sample markers would strand a character. Keep the backup outside Git. The Production Vercel build does not run this seed.
