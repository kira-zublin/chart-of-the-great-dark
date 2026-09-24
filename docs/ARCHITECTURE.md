# Architecture

## First persistent slice

The original static star map remains in `index.html`. A small browser module in `app.js` handles the sign-in and character UI. Vercel Node.js Functions in `api/` own registration, sign-in, session cookies, character records, and images. The server treats all browser input as untrusted.

Postgres is the authoritative store for profiles, sessions, characters, and their two optional images. The schema lives in `db/001_initial.sql`; apply it once to each environment before using the new application. The application never creates or resets tables during a request. A managed Neon database connected through Vercel Marketplace is the intended production store. `DATABASE_URL` may point to any compatible Postgres database.

The first version stores images as bounded byte arrays in Postgres to avoid a separate file service. Each slot accepts at most 2 MB, with PNG, JPEG, and WebP signatures checked on the server. If this small group's image volume grows, migrate the bytes to object storage without changing character ownership.

The registration invite code is a shared secret stored in `REGISTRATION_INVITE_CODE` on the server. A registrant chooses a name, password, and player or GM role. Passwords use salted scrypt hashes; repeated wrong passwords lock a profile for 15 minutes. Sessions use random opaque tokens; only token hashes are kept in the database, and the browser receives an HTTP-only, same-site cookie for 30 days. Logout deletes the session. GM status is persisted on the server and checked by the API. Anyone with the registration code may create a GM profile by design.

Players can list, edit, and delete their own PCs. GMs can list and filter all characters, edit any PC, and create, edit, or delete NPCs. The selected character ID is remembered locally per profile for the UI; the database remains authoritative for character data.

## Environments and durability

Use separate Postgres databases for Preview/Development and Production. Configure both `DATABASE_URL` and `REGISTRATION_INVITE_CODE` in the corresponding Vercel environments. Do not use production data for automated tests or preview experiments. Back up the production database before future schema migrations; do not reset it when deploying a new build.

The rules PDFs are local references in `gamerules/` and are deliberately excluded from Git. The character sheet currently covers identity, description, and the six core attributes from the Explorer Sheet. Additional rules fields, maps, NPC authoring beyond a basic NPC record, chat, and presence remain future features.
