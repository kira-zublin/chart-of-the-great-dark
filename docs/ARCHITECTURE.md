# Architecture

## First persistent slice

The original static star map remains in `index.html`. A small browser module in `app.js` handles the sign-in and character UI. Vercel Node.js Functions in `api/` own registration, sign-in, session cookies, character records, and images. The server treats all browser input as untrusted.

Turso Cloud (libSQL/SQLite) is the authoritative store for profiles, sessions, characters, and their two optional images. The schema lives in `db/001_initial.sql`; apply it once to each environment before using the new application. The application never creates or resets tables during a request. The Turso integration for Vercel provides `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to server-side Functions. For local tests, the same client can use a temporary SQLite file.

The first version stores images as bounded BLOBs in Turso to avoid a separate file service. Each slot accepts at most 2 MB, with PNG, JPEG, and WebP signatures checked on the server. If this small group's image volume grows, migrate the bytes to object storage without changing character ownership.

The registration invite code is a shared secret stored in `REGISTRATION_INVITE_CODE` on the server. A registrant chooses a name, password, and player or GM role. Passwords use salted scrypt hashes; repeated wrong passwords lock a profile for 15 minutes. Sessions use random opaque tokens; only token hashes are kept in the database, and the browser receives an HTTP-only, same-site cookie for 30 days. Logout deletes the session. GM status is persisted on the server and checked by the API. Anyone with the registration code may create a GM profile by design.

Players can list, edit, and delete their own PCs. GMs can list and filter all characters, edit any PC, and create, edit, or delete NPCs. The selected character ID is remembered locally per profile for the UI; the database remains authoritative for character data.

## Environments and durability

Use separate Turso databases for Preview/Development and Production. Configure `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `REGISTRATION_INVITE_CODE` in the corresponding Vercel environments. Do not use production data for automated tests or preview experiments. Back up the production database before future schema migrations; do not reset it when deploying a new build.

The rules PDFs are local references in `gamerules/` and are deliberately excluded from Git. Further rules automation, maps, NPC authoring beyond a basic NPC record, and presence remain future features.

## Expanded sheets and shared crew

`db/002_sheets_and_crew.sql` adds a validated JSON `sheet` column to characters without replacing the original fields. Existing characters receive an empty sheet that the UI fills with defaults. Repeatable talents and gear live in this bounded JSON object; the API validates types, lengths, and item counts before writing. `scripts/migrate-002.js` applies this migration explicitly and skips the already-added column when rerun.
`db/003_crew_images.sql` adds two shared portrait slots (crew and Bird). The image API accepts signed-in profiles, checks JPEG/PNG/WebP signatures and the 2 MB limit, and stores image bytes in Turso. Apply it with `scripts/migrate-003.js` before deploying code that reads `crew_images`.

The crew is a single durable row in Turso, with five role slots in `crew_roles` referencing character IDs. The database prevents the same character occupying two slots and clears references when a character is deleted. The API requires a session for every read and write. Players may assign or clear their own PCs; the GM may manage any PC. Other crew fields are shared edits by all signed-in profiles. Each field-sized patch uses a revision comparison; a stale write receives HTTP 409 instead of overwriting newer state. Role assignment compares the expected occupant in SQL before changing the slot.

While the Crew Sheet is open, clients fetch the latest state every four seconds and on returning to the browser tab. They immediately refetch after successful writes; polling pauses during active field editing. Turso remains authoritative, so refreshes and separate Vercel Function instances see the same state. This near-real-time approach adds no dedicated messaging service. Chat or subsecond presence can later use a push transport without changing the crew persistence model.

## Campaign chat and dice

`db/004_chat.sql` adds one shared campaign message stream. Vercel's Turso integration creates a distinct database for each Preview deployment, so the Preview build applies this idempotent migration after the integration provisions the database. Production builds skip it; back up Production and apply `scripts/migrate-004.js` explicitly before merging chat. Messages retain player and character name snapshots, server timestamps, text or complete roll results, and an optional character reference. Deleting a character clears the reference but preserves the name and log; its portrait then falls back to the generic asset. Every chat API request requires a session. Sending with a character requires current ownership of a PC, except that a GM may use any character. All signed-in users can read history and download a UTF-8 text log for inclusive UTC dates.

`db/005_chat_push.sql` adds an optional reference from a pushed roll to its preceding roll and a unique index that prevents duplicate pushes. Preview builds apply both chat migrations; before a Production merge, back up Production and apply `scripts/migrate-004.js` followed by `scripts/migrate-005.js`.

The server performs all d6 rolls with cryptographic randomness. The roll dialog supports manual base and gear pools or a character action using a stored attribute and one stored talent level. A player-entered modifier changes base dice, never gear dice, with a minimum of one base die. Every six is a success. A push rerolls only dice showing two through five; all dice count afterward. The push result records Hope loss for base ones and gear wear for gear ones, without changing character or item sheets automatically. The server allows one push, or two for an Empathy roll by a character with Renowned. Each result is its own persistent chat entry, including in text exports. Chat updates poll the API every two seconds and on tab return, using message IDs to handle ordering and reconnects. The initial read returns the latest 100 messages; downloads can include the full requested date range. The full-width chat dock stores its chosen height in local browser storage.
