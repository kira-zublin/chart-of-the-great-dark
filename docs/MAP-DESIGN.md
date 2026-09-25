# Map design decisions

Player-facing names are **Hub** for the stored `settlement` view, **Explorable** for `delve`, and **Vista** for `diorama`. The stored kind identifiers stay stable. The root star-chart area is titled **Chart of the Great Dark**.

This document records decisions for the next map prototype. The existing static Star Map and character UI remain the current implementation; the systems below are planned.

## World structure

- The Star Map is the root view. Enterable locations use Settlement, Delve, or Diorama views. Points of Interest provide information but cannot be entered.
- Explicit connections describe map markers and doors between locations, including Delve-to-Delve links. Connections can carry an arrival square for each destination entrance. They do not require players to follow a fixed route: a player may enter any Accessible marker.
- A location may also have an optional **parent** for context and navigation. Parentage does not limit connections or imply a travel rule. Back opens the current location's parent; without a parent, Back is disabled.
- A Settlement presents a pannable, wheel-zoomable 2D background with clickable location markers anchored to the map. Settlements can contain markers for any type, including other settlements. A Delve presents a gridded tactical map. A Diorama presents character and creature stand-ups over a background.
- Location discovery and access are shared across the party. **Invisible** locations have no player-visible marker or description. **Inaccessible** locations show a marker and description, with entry disabled. **Accessible** locations can be entered and moved into. The server enforces these states for character movement and map art.
- The GM can edit the current location or a marker destination from the current Star or Settlement map. Settlement markers can be dragged to reposition them, with coordinate fields for precise placement. Newly created locations remain on the source map for immediate editing.

## Viewing and character position

- Viewing a location is separate from moving a character. Opening a marker changes the view and displays information; **Move Here** is an explicit action that changes the selected character's persistent location. If no player character is active, the movement dock offers a character-selection button instead of silently disappearing.
- In a Settlement, selecting a marker opens a description dossier first. The dossier's **Enter location** button changes the viewed location. **Move Here** is a separate control centered above the chat dock when the selected character is elsewhere.
- The player can browse the world while their character remains elsewhere. The interface should clearly show both the viewed location and the character's actual location. Character presence and tokens derive from actual position, not from an open browser view.
- Switching the active character opens that character's current location. Characters initially start at the Star Map. A character there is described as viewing the Star Map and needs no chart coordinates. A ship marker may be added later under GM control.
- In Delves, character and creature positions use grid squares; doors specify the square where an arriving character is placed. In Dioramas, character and creature positions use scene coordinates. The first prototype allows direct dragging without movement rules.
- Each Delve has a default arrival square in its prepared grid data. An arrival through a door uses that door's destination square instead. If the preferred square is blocked or occupied, place the arriving character in the nearest open, unoccupied square. This also applies when the GM pulls several characters into a Delve. Two characters must not occupy the same square.
- The GM browses independently of any selected character. **Pull Characters** opens a picker for any or all existing player characters and moves those selected into the GM's viewed location.

## Creatures

The GM needs a searchable creature palette and the ability to create entries. This will replace the current GM NPC management interface. Creatures and PCs share identity, images, and some sheet concepts, but palette entries and placed creature instances have different behavior from player-controlled characters. The exact storage model remains open until the first creature workflow is designed.

## Delve grid and rooms

- Grid squares are either open or blocked for token placement. Players drag their own token to an open, unoccupied square. The server validates the move and is authoritative when two moves race.
- While dragging a token, a visual copy follows the pointer and the target square highlights. The original token remains in place until the server accepts the drop.
- A room is a named set of grid squares used for visibility control. A door is an interactive entrance connecting locations, with a destination and arrival square. Doors are separate from room definitions.
- Each room's visibility setting defaults to **Automatic**. The GM can override it with **Show** or **Hide**. When fog of war is enabled for a Delve, Automatic rooms are visible while occupied by a player character and obscured while unoccupied. When fog is disabled, Automatic rooms are visible. Show rooms stay visible and Hide rooms stay obscured regardless of fog or occupancy.
- Creature footprints may be larger than one square (the brainstorming document calls for 2x2 creatures); placement and movement must account for the whole footprint.
- Fog hides room artwork, tokens, doors, and markers together. Open squares without an explicitly defined room belong to one implicit **Other squares** room for fog purposes. Blocked squares need no room assignment.

## First playable slice

The first prototype uses a small prepared journey through the Star Map, Ship City, Dockside Exchange, and two connected Choir Delves. It includes persistent character position, room fog, GM pulls, basic GM creation/editing, and background uploads. GM room-square drawing, a creature palette and creature tokens, and importing the complete published world are later work. GM-created Delves begin with a simple open grid and one room; the prepared sample Delves demonstrate multiple rooms and blocked squares.

## Later decisions

- Should creature tokens also reserve grid squares against player movement once creature placement is implemented? The intended direction is yes, for the full footprint.
- Should the nearest-square search treat diagonal squares as adjacent, and can it place a character on a square physically disconnected from the entrance when the nearby area is full?
- Are creature palette entries reusable templates with multiple placed instances, or does each creature record represent one individual that can appear in only one location?
