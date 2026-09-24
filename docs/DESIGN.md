# First feature: profiles and characters

The application opens at a sign-in page. A new player or GM enters a profile name, password, shared invitation code, and desired role. Returning users sign in with their name and password. The browser keeps an HTTP-only session cookie for 30 days; logout clears it. Anyone with the invite code may choose GM at registration, as requested for this private group.

After sign-in the existing star map appears. The profile menu in the upper left shows the name and role and offers logout. The upper-right character menu replaces Reset Chart. It offers a list, character creation, and a confirmation before permanent deletion. Player lists show only their own PCs. GM lists show every PC and NPC, with a filter by type. GMs may edit PCs and create and edit NPCs.

The first character panel contains name, profession, origin, faction, appearance, motivation, freeform description, and the six Explorer Sheet attributes: Strength, Agility, Logic, Insight, Perception, and Empathy. It also accepts a portrait and a full stand-up image. This first pass records values without enforcing character-creation point budgets or game rule calculations; those belong to a later rules-specific iteration.

The map's existing panning, zooming, markers, dossier, and assets remain intact. Character edits save to the server. The browser remembers the selected character locally for convenience, while its fields and images are loaded from persistent storage.

## Character and crew sheets

The character panel has four keyboard-accessible tabs. Profile holds identity, contacts, quirk, description and images. Abilities holds attributes, talents and experience; it shows the starting 24-point guideline without blocking established characters. Condition holds current Health, Hope, Heart, six conditions and freeform injury/trauma/Blight notes. Gear holds weapons, armor, equipment, tiny items, Supply, rukh and a keepsake. Tab changes keep the draft intact. Closing or switching away with unsaved changes asks for confirmation.

The Crew Sheet is a separate panel available to every signed-in profile. Its five tabs are Crew Info, Maneuvers, Bird, Rover, and Shuttle. Crew Info includes the crew portrait, name, points, and five role slots. Maneuvers are separate addable rows. Bird includes a portrait and multi-line appearance and description; Rover and Shuttle have multi-line cargo. Players can place their own PCs in an empty slot or remove their own assignment; the GM can manage any PC. Every shared field saves on change. The panel refreshes during play and reports conflicts rather than silently replacing another person's edit.
