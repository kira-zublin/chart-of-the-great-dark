# Coriolis Mapping Project — Agent Instructions

Player-facing map terminology: **Hub** (stored as `settlement`), **Explorable** (stored as `delve`), and **Vista** (stored as `diorama`). Keep stored kind identifiers stable until a deliberate data migration. The root star-chart location is named **Chart of the Great Dark**; it is an area title, not a persistent page title.

## Project Overview

This repository contains a multiplayer web application for a private tabletop RPG campaign using the Coriolis setting.

The application is intended to provide a focused subset of functionality similar to a virtual tabletop such as Roll20, while emphasizing exploration, atmosphere, character management, and custom map interfaces designed specifically for this campaign.

The application will support:

* Player authentication and persistent player accounts.
* Character creation and management.
* Interactive Coriolis character sheets.
* Selection of an actively controlled character.
* Separate GM capabilities and permissions.
* NPC creation and management.
* Persistent campaign/world data.
* Multiplayer presence.
* Real-time player chat.
* Dice rolling.
* Multiple interconnected map views.
* Player tokens/characters positioned within the game world.
* GM world-building and map-authoring tools.
* Custom generated visual assets.
* A cohesive visual style inspired by Coriolis.

This is a long-lived application. Architectural decisions should favor maintainability, data safety, understandable abstractions, and incremental development over quick disposable solutions.

---

# 1. Authoritative Project Documentation

The repository is the authoritative source for project requirements.

Before implementing substantial functionality, consult the relevant documentation.

Primary documents:

* `AGENTS.md`

  * Instructions governing how coding agents should work.

* `docs/DESIGN.md`

  * Overall product goals, user experience, terminology, and feature behavior.

* `docs/ARCHITECTURE.md`

  * Technical architecture, application boundaries, data flow, persistence, networking, and infrastructure decisions.

* `docs/UI-GUIDE.md`

  * Visual language, UI conventions, typography, colors, animations, iconography, and asset-generation guidance.

* `docs/systems/`

  * Detailed specifications for individual systems.

When implementation and documentation disagree, do not silently choose one.

Identify the discrepancy and prefer the most recently established explicit project requirement.

Update documentation when a completed implementation materially changes an established system.

---

# 2. Development Philosophy

Work incrementally.

Prefer:

* Small, comprehensible changes.
* Explicit interfaces between systems.
* Reusable components where reuse is genuine.
* Clear domain models.
* Stable data structures.
* Testable logic.
* Progressive enhancement of existing systems.

Avoid:

* Large speculative abstractions.
* Rewriting working systems without a concrete reason.
* Introducing dependencies for trivial functionality.
* Combining unrelated changes into a single implementation task.
* Silent architectural changes.
* Temporary hacks that can corrupt persistent campaign data.

Preserve existing behavior unless the current task explicitly changes it.

Before modifying unfamiliar code, inspect the relevant implementation and understand how it currently works.

---

# 3. Core Application Domains

The application is expected to contain several major domains.

Keep these concerns conceptually distinct even when they interact.

## Authentication and Users

The application supports authenticated users.

Users may have different roles, including at minimum:

* Player
* GM

Authorization must be enforced by application logic and server-side/data-layer permissions where appropriate.

Never rely solely on hidden UI elements for authorization.

A player must not gain GM capabilities simply by manipulating client-side state.

---

## Characters

Players can create and manage player characters.

Character data will eventually include:

* Identity and descriptive information.
* Character statistics.
* Skills.
* Talents.
* Equipment.
* Conditions or status.
* Other Coriolis-specific character-sheet data.

A player may own or have access to multiple characters.

The application must support selecting an active character representing the character the player is currently controlling.

GM users will have related but distinct NPC-management capabilities.

Do not assume that player characters and NPCs are necessarily identical domain objects unless the architecture explicitly establishes this.

---

## Persistent Campaign Data

Campaign data must survive:

* Browser refreshes.
* User logout/login.
* Application restarts.
* New builds.
* Vercel deployments.
* Replacement of application server instances.

Never store authoritative campaign data only:

* In process memory.
* In browser state.
* In temporary filesystem storage.
* Inside a deployment artifact.

Persistent state must use the project's established persistent data layer.

Treat campaign data as valuable.

Schema changes must be designed to avoid accidental data loss.

Do not reset, destroy, reseed, or replace production data unless explicitly instructed.

---

## Multiplayer and Presence

The application will support multiple players simultaneously.

Expected multiplayer functionality includes:

* Logged-in player presence.
* Identification of currently connected players.
* Real-time or near-real-time chat.
* Dice rolls visible to relevant users.
* Eventually, synchronized world/map state.

Client state should not be treated as authoritative for shared multiplayer information when a server or persistent shared source is appropriate.

Design multiplayer systems with reconnects and temporary network failures in mind.

---

## Dice

Dice rolling is a game action, not merely a visual animation.

When implementing dice mechanics, distinguish between:

* The actual random result.
* Game-rule interpretation.
* Presentation and animation.
* Chat/history records.

Game results that affect shared play should be capable of being communicated reliably to other connected users.

Do not change Coriolis game mechanics without an explicit design requirement.

---

# 4. Map Architecture

The world uses four major map/view modes.

These are separate experiences within the same persistent campaign world.

## Star Map View

Represents large-scale interstellar navigation and locations.

Expected content may include:

* Stars.
* Systems.
* Routes.
* Delves.
* Regions.
* Missions or discoveries.
* Player/ship position.
* GM-created locations.

The existing Coriolis star map is expected to evolve into this layer.

Preserve working existing functionality unless a task explicitly replaces it.

---

## Settlement View

Represents a focused 2D area with a background and clickable location markers. Settlements may contain markers for any location type, including other settlements.

Do not assume that Settlement View behaves identically to the Star Map or Delve View.

---

## Diorama View

Represents locations through a more visual, atmospheric, scene-oriented presentation.

This view may contain interactive scene elements and generated visual assets.

Its implementation should emphasize atmosphere without compromising usability.

---

## Delve View

Represents top-down positional gameplay.

Expected eventual functionality may include:

* Maps.
* Character/NPC tokens.
* Positioning.
* Movement.
* Interactive map objects.
* GM controls.

Do not implement a full general-purpose virtual tabletop unless explicitly requested.

The goal is the subset of tactical functionality useful to this campaign.

---

# 5. Map Transitions and World State

The Star Map, Settlement, Diorama, and Delve are views of one persistent campaign world. Points of Interest are informational markers and cannot be entered.

Use explicit connections between locations for travel, including non-hierarchical links between Delves. A separate optional parent reference supports context such as the current planet and the Back button; it does not constrain which locations can connect. Back opens the current location's parent, or is disabled when there is no parent.

Viewing a location and moving a character there are distinct actions. Visible map markers may be opened for information without changing character position. Party discovery and visibility are shared. The Star Map is the root view; characters there need no map coordinates.

The GM may browse locations without a controlled character and pull selected player characters to the GM's current location. See `docs/MAP-DESIGN.md` for the current map decisions and remaining questions.

Avoid tightly coupling global campaign data to the rendering implementation of one particular map type.

---

# 6. GM Tools

GM users will require world-authoring functionality.

Expected capabilities include creating and modifying things such as:

* Stars.
* Locations.
* Areas.
* Maps.
* NPCs.
* Interactive objects.
* Campaign content.

GM functionality should use the same underlying persistent world model as player-facing functionality wherever practical.

Do not maintain unrelated duplicate versions of campaign state for the GM and players.

Clearly separate:

* Data.
* Editing tools.
* Player presentation.

Changes made by the GM should eventually propagate appropriately to connected players.

---

# 7. UI Principles

The application should feel like a cohesive game interface rather than a generic CRUD/business application.

At the same time:

* Readability comes before decoration.
* Important controls must remain discoverable.
* Visual effects must not obscure interaction state.
* Animations should support meaning and atmosphere.
* Interface behavior should remain predictable.

Consult `docs/UI-GUIDE.md` before making substantial visual changes.

Prefer reusable primitives for recurring interface concepts such as:

* Panels.
* Modals.
* Buttons.
* Tooltips.
* Tabs.
* Context menus.
* Character portraits.
* Map markers.
* Status indicators.

Avoid creating visually similar components independently when a shared component already exists.

---

# 8. Coriolis Visual Direction

The application should maintain a visual language inspired by Coriolis.

The intended direction includes concepts such as:

* Ancient technological interfaces.
* Ornate science-fiction design.
* Mysticism mixed with machinery.
* Astronomical/navigation imagery.
* Brass, gold, dark metal, and aged-material influences where appropriate.
* Strong silhouettes.
* Decorative but readable interface framing.
* Atmospheric maps and illustrations.

The project should not simply reproduce copyrighted published artwork.

Use original assets and original interpretations of the project's visual direction.

When exact visual rules have been established, `docs/UI-GUIDE.md` takes precedence over this general description.

---

# 9. Generated Assets

AI-generated visual assets are a normal part of this project's development workflow.

Agents may generate assets when the task calls for bespoke artwork or UI imagery and an appropriate image-generation capability is available.

Production assets belong under:

`public/assets/`

Use organized subdirectories such as:

* `public/assets/icons/`
* `public/assets/ui/`
* `public/assets/maps/`
* `public/assets/backgrounds/`
* `public/assets/characters/`
* `public/assets/locations/`

Use descriptive kebab-case filenames.

Example:

`public/assets/icons/star-gate-active.png`

Never reference:

* Temporary image-generation URLs.
* Chat attachment URLs.
* Local files outside the repository.
* Uncommitted temporary assets.

When adding an asset:

1. Generate or obtain the final asset.
2. Place it in the correct repository asset directory.
3. Verify the filename and path.
4. Reference it through the application's established asset convention.
5. Run the application.
6. Verify that the asset actually loads.
7. Verify its appearance at relevant UI sizes.
8. Commit the asset alongside the code that uses it.

When replacing an existing generated/CSS visual element, preserve separately implemented animation or interaction behavior unless explicitly instructed otherwise.

---

# 10. Responsive Design

The primary experience may favor desktop/laptop use, but components should not unnecessarily assume one exact screen resolution.

Avoid hard-coded positioning that breaks under ordinary changes in viewport dimensions.

Complex map interfaces may have explicit minimum practical dimensions when justified.

Document those constraints when they exist.

---

# 11. Accessibility and Input

Use semantic HTML and accessible controls where practical.

Interactive elements should normally:

* Be keyboard accessible.
* Have clear focus states.
* Have meaningful labels.
* Not depend entirely on color to communicate critical state.

Maps and game interfaces may require specialized interactions, but standard controls should still follow normal accessibility expectations.

---

# 12. Security

Treat all data received from the client as untrusted.

Never expose privileged credentials or server secrets to browser code.

Never commit secrets to the repository.

Use environment variables or the project's established secret-management mechanism.

Enforce authorization for GM-only operations.

Validate persistent data at trusted boundaries.

Do not allow clients to arbitrarily modify another user's characters or protected campaign state.

Take additional care around:

* Authentication callbacks.
* Session handling.
* Database mutations.
* File uploads.
* User-generated chat content.
* GM-only APIs.

---

# 13. Database and Schema Safety

The specific persistence technology will be documented in `docs/ARCHITECTURE.md`.

Once persistent player/campaign data exists:

Never perform destructive schema operations casually.

Before schema changes:

1. Understand existing persisted data.
2. Determine migration requirements.
3. Preserve backwards compatibility when practical.
4. Use explicit migrations where supported.
5. Avoid destructive resets.

Development seed data must be clearly distinguishable from production campaign data.

Never assume production data can be recreated.

---

# 14. Real-Time Architecture

The specific real-time technology is not yet mandated by this document.

When implementing multiplayer functionality, document the chosen architecture in `docs/ARCHITECTURE.md`.

Prefer a centralized shared-state model appropriate to the feature rather than ad-hoc client synchronization.

Consider:

* Reconnection.
* Duplicate events.
* Ordering.
* Stale clients.
* Authorization.
* Presence expiry.
* Multiple browser tabs.
* Persistent vs ephemeral events.

Not every real-time event must be permanently stored.

Determine persistence requirements based on the domain.

For example:

* Presence may be ephemeral.
* Character data must be persistent.
* Chat history may be persistent depending on the final design.
* Dice rolls may be retained as game/chat history depending on the final design.

---

# 15. Application State

Keep clear distinctions between:

* Persistent server state.
* Shared live multiplayer state.
* User session state.
* Local UI state.

Do not put everything into one global client-side state store simply because it is convenient.

Prefer the narrowest sensible scope for state.

---

# 16. Testing Requirements

Before declaring an implementation complete, perform the checks relevant to the project.

At minimum:

* Run linting if configured.
* Run type checking if configured.
* Run automated tests relevant to the change.
* Run the production build.
* Verify that the development application starts.
* Check browser console errors for UI work.

For UI changes, inspect the actual rendered result.

Do not declare visual work complete based only on source-code inspection.

For multiplayer changes, test with multiple sessions/users where practical.

For persistence changes, verify that data survives reload/reconnect behavior.

For authorization changes, test both permitted and prohibited roles.

---

# 17. Browser Verification

When browser automation or browser inspection tools are available, use them for meaningful UI changes.

Verify:

* Page loads.
* Expected components render.
* Assets load successfully.
* No obvious console errors occur.
* Primary interactions work.
* Layout has not obviously regressed.

Screenshots can be useful for visual verification, but screenshots do not replace interaction testing.

---

# 18. Build Integrity

Never knowingly leave the repository in a broken build state.

A task is not complete if:

* The production build fails.
* Required imports are missing.
* Assets return 404 errors.
* Critical runtime errors occur.
* Existing core functionality is unintentionally broken.

If an unrelated pre-existing error prevents validation, clearly identify it.

Do not silently disable tests, type checking, or lint rules merely to make a build pass.

---

# 19. Git Workflow

GitHub is the canonical source repository.

Normal development workflow:

1. Start from an up-to-date production/default branch.
2. Create a focused feature branch.
3. Implement the requested work.
4. Test locally.
5. Review the diff.
6. Commit coherent changes.
7. Push the feature branch.
8. Verify the Vercel Preview deployment.
9. Make corrections if necessary.
10. Merge only after the feature has been approved.

Prefer descriptive branch names such as:

`feature/character-sheet`

`feature/player-chat`

`fix/star-icon-paths`

Prefer focused commits with descriptive messages.

Do not rewrite shared Git history unless explicitly instructed.

Do not force-push without explicit authorization.

---

# 20. Deployment

The application is deployed through GitHub and Vercel.

The normal deployment path is:

Local repository
→ GitHub branch
→ Vercel Preview
→ verification
→ merge to production branch
→ Vercel Production

Do not bypass this process for ordinary feature development.

A successful deployment does not by itself mean a task is complete.

Verify the deployed application when appropriate.

Never assume an asset exists in Vercel merely because it exists somewhere on the development machine. Production assets must be committed to the repository or otherwise deliberately provisioned.

---

# 21. Environment Configuration

Do not commit `.env` files containing secrets.

When adding a new environment variable:

* Use a descriptive name.
* Document its purpose.
* Update an example environment file when appropriate.
* Identify whether it is required for development, preview, production, or all three.
* Ensure secrets remain server-side unless intentionally public.

Public/browser-accessible environment variables must not contain secrets.

---

# 22. Dependencies

Before adding a dependency:

* Check whether the project already has a suitable solution.
* Prefer mature, maintained packages.
* Avoid large libraries for tiny features.
* Consider client bundle impact.
* Consider compatibility with the project's hosting environment.

Do not replace established libraries simply because another library is personally preferable.

Major dependency or framework changes require explicit project direction.

---

# 23. Performance

Maps and multiplayer interfaces may eventually contain many dynamic elements.

Avoid obvious performance traps such as:

* Unbounded render loops.
* Excessive global re-renders.
* Repeated loading of identical large assets.
* Sending full world state when a small update is sufficient.
* Persisting high-frequency transient events unnecessarily.

Optimize based on evidence rather than premature micro-optimization.

---

# 24. Error Handling

User-facing operations that can fail should fail understandably.

Do not leave the user with only a console exception for failures involving:

* Login.
* Character saving.
* Chat.
* Map loading.
* Asset upload.
* GM editing.
* Network operations.

Preserve useful diagnostic information for development without exposing secrets to users.

---

# 25. Feature Implementation Process

For a substantial feature:

1. Read this file.
2. Read the relevant design/system documentation.
3. Inspect the existing implementation.
4. Identify the smallest coherent implementation path.
5. Implement the feature.
6. Add or update tests where appropriate.
7. Run project validation.
8. Inspect the rendered behavior.
9. Update documentation if architecture or established behavior changed.
10. Review the final diff for unrelated modifications.

If the task is ambiguous but existing project conventions clearly answer the ambiguity, follow those conventions.

If an ambiguity would cause a substantial architectural or user-experience decision, surface it rather than inventing a permanent project rule.

---

# 26. Scope Control

Do not opportunistically redesign unrelated portions of the application.

During feature work, small supporting refactors are acceptable when necessary.

Large unrelated refactors should be proposed separately.

A request to modify one system is not permission to restructure the entire application.

---

# 27. Temporary Implementations

Prototype functionality is acceptable when explicitly requested.

Clearly distinguish prototypes from production systems.

Do not allow temporary mock persistence, fake authentication, or placeholder multiplayer behavior to become silently treated as production architecture.

If a temporary implementation is introduced, document the limitation.

---

# 28. Current Architectural Status

Some major technology choices may still be undecided.

Do not infer permanent choices from temporary prototypes.

The following should be documented in `docs/ARCHITECTURE.md` as decisions are made:

* Frontend framework and rendering architecture.
* Authentication provider.
* Database technology.
* ORM/data-access strategy.
* Real-time communication technology.
* File/image storage.
* Deployment/environment strategy.
* Client state-management approach.
* Testing stack.

Once documented there, follow those decisions unless explicitly instructed to revisit them.

---

# 29. Definition of Done

A feature is complete when the relevant combination of the following is true:

* Required behavior exists.
* Existing behavior has not unintentionally regressed.
* Persistent data behaves correctly.
* Authorization behaves correctly.
* Multiplayer synchronization behaves correctly where applicable.
* UI is visually integrated with the project.
* Required assets exist and load.
* Tests/checks pass.
* Production build succeeds.
* The feature has been inspected in the running application.
* Documentation reflects important architectural changes.
* The implementation is committed cleanly and ready for preview deployment.

Passing compilation alone is not sufficient.

---

# 30. Guiding Principle

This application is intended to become a persistent digital representation of an ongoing campaign world.

Treat its code, world data, characters, and visual identity as durable project assets.

Favor changes that leave the system easier to understand, safer to modify, and more coherent than it was before.
