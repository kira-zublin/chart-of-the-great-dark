# Nonhuman creature portraits

The 15 original portraits in `assets/creatures/` correspond to the nonhuman `book_key` values in the local creature library. Each is a 256×256 JPEG. The built-in image generation tool made the initial square illustrations; they were reduced to 256×256 at JPEG quality 82 and reviewed together at 128 pixels. Import them into the existing database image slots with `scripts/import-creature-portraits.js` after importing the rulebook creature library.

## Shared generation prompt

> Use case: illustration-story. Asset type: square creature portrait for a tabletop palette, ultimately displayed at 42-112 pixels. Original watercolor-led book illustration with broad translucent washes, pigment blooms and backruns, visible warm paper, paint flecks, loose brushwork, softened lost edges, sparse ink at defining anatomy, muted blue-green and charcoal with restrained accents. One large centered subject, strong recognizable silhouette, key anatomy fills the circular-safe middle 80 percent. Dark quiet background. No text, label, border, frame, watermark, photorealism, glossy 3D, generic fantasy embellishments. Specific creature: [subject below].

The first three prompts used “sparse ink at the face or defining anatomy” and “local practical glow where justified”; the remaining prompts used the wording above. All other constraints were the same.

## Subject clauses

| Book key | Subject clause |
| --- | --- |
| `blight-crawlers` | A tight cluster of black fist-sized iridescent beetle-like Blight Crawlers skittering over tainted ship hull metal; reflective shells, dust flakes and fresh barnacle encrustation. Show beetle anatomy and swarm identity clearly. |
| `fallowbloom` | A single massive bulbous predatory flower-like Fallowbloom, sharp jagged petals spiraling around a deep shadowy core; black oily surface with restrained fiery orange, spectral purple, and liquid blue iridescence. |
| `kwane-bird` | A corrupted Bird called the Kwanë, unmistakably avian, with a blood-red blade-like beak, distorted plumage and predatory posture. Disturbing Blight corruption without turning it into a humanoid. |
| `snake-vine` | A predatory Snake Vine disguised among harmless red ivy: powerful coiling vine tendrils, hooked burrowing thorns and red leaves, one striking tendril lifted like a snake. Botanical plant, not an animal-headed monster. |
| `cinderfish` | A floating Builder construct called a Cinderfish: smooth faintly luminous two-meter bulb like a jellyfish bell, long fine trailing tentacles, ancient engineered ceramic or mineral material, subtle signs of Blight corruption. It floats in air, not underwater. |
| `gargantuan` | A colossal guardian construct called the Gargantuan: ancient alien clockwork machinery in a roughly humanoid shape, pronged misshapen faceless eyeless head, massive shoulders, cross-tipped club visible beside it. Convey enormous scale without relying on tiny people. |
| `glyph-golem` | A Glyph Golem emerging from an ancient Builder wall: massive hulking humanoid body of weathered stone, meandering luminous glyph patterns flowing from wall into shoulders and face, monumental protective silhouette. Avoid invented readable letters. |
| `sentry-hound` | A Sentry Hound guardian construct: hound-like animal body sculpted as one smooth ceramic shell, angular head, short hornlike protrusions, uncanny mirror-like eyes, ready to spring. Clearly mechanical ceramic, not a furry dog. |
| `heaphog` | A domesticated heaphog: huge lumbering silicate beast with great folds of charcoal skin, a shrunken eyeless head with several misshapen protrusions, and a practical breathing apparatus fitted to its head. Focus on the eyeless head and skin folds. |
| `nekatra` | A predatory Nekatra: canine creature walking upright with hard sinewy musculature, thin sparse fur, large fangs and wild eyes. Clearly an animal predator, not a dressed humanoid or conventional wolf. |
| `ship-mites` | A close macro cluster of finger-sized gray ship mites, insect bodies swarming over and dissolving a worn starship bulkhead beside a slab-like hive. Make the insect form legible, with a strong central specimen and hints of swarm. |
| `slipstream-nieba` | A Slipstream Nieba clinging to a starship hull: vast semi-ethereal cloud coalesced into a gelatinous mass, translucent tendrils drawing energy from metal seams, cosmic darkness behind. Alien cloud organism rather than jellyfish or human ghost. |
| `wraithlight` | A Wraithlight in the Slipstream: a faint, haunting vision of a lost human companion appearing in alien darkness beyond a ship hull, figure dissolving into delicate light and shadow. The image should read as an alluring ghostly apparition at thumbnail size, not a solid person. |
| `conduit-specter` | A Conduit Specter manifesting within an old ship's engine corridor: flickering electric shadow briefly taking an unstable humanoid outline amid dense cables and conduits, crackling with blue-green current. Ghost in machinery, no solid human body. |
| `haubrioc-bird` | A Haubrioc Bird echo: unmistakable bird-of-prey shape, shadowy and flickering, fractured repeated outlines like reflections through cracked mirrors. Ominous avian head and wings emerge from ruined darkness, no normal solid feathers. |
