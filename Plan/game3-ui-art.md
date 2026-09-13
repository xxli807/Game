# Game3 UI artwork, September 2026

## Current entry points: text and 3D (2026-09-13)

The lobby now offers two equal, clearly described modes after ruler selection:

- **进入天下** preserves the existing text/event-choice game, including its original outcome rules and illustrated cards.
- **Start Playing** starts the continuous 3D game, including movement, combat, escorts and in-world decisions.

`src/game3/GameModes.tsx` contains the entry cards. `App.tsx` stores the selected mode for the run; URL parameters are no longer needed to access the text game. Each start uses the selected ruler and existing shared unlock data. The text help explains reading and choices; the lobby additionally explains 3D controls. Earlier sections below describe the chronological art work, not a requirement to replace text mode.

Verified: all three production builds and smoke checks pass, including both v3 modes. Browser checks at 1280 px and 390 px confirm both entry buttons, selected ruler preservation, exiting 3D with renderer cleanup, starting a subsequent text run, advancing a text choice, and correct help text; no console errors or horizontal lobby overflow. No event numbers or outcome rules changed for this split.

Generated with the built-in image_gen tool. Runtime asset: `public/arts/v3-ui/dynasty-dawn.jpg` (461 KB JPEG). Original retained outside the repository in Codex's generated_images directory.

Prompt:

> Use case: stylized-concept. Asset type: wide game lobby hero illustration for an original Chinese dynasty strategy game. A monumental bronze ding ritual vessel in foreground at right, a winding river and fortified late imperial Chinese capital below distant layered mountains, tiny vermilion war banners, storm clouds parting with muted golden dawn. Hand painted historical epic concept art with delicate ink contours and weathered parchment grain, charcoal jade shadows, antique gold and restrained cinnabar. Wide landscape 1536x1024 composition, left third atmospheric dark negative space suitable for separate HTML title, beautiful detailed right-hand focal point. Serious feudal political atmosphere, original Chinese architecture and ornament. No text, no lettering, no logos, no watermark, no recognizable franchise elements.

The illustration appears in the lobby and as a generic fallback for events without dedicated artwork. Existing first-act illustrations take precedence. The territory map is an original SVG schematic with live city ownership; it is not a geographically exact map. Resource indicators show only the five existing qualitative bands, preserving the current rules' deliberately hidden numeric values.

The current implementation has four resources (military, politics, economy, destiny) and advances time through actions. Earlier six-resource and real-time descriptions in repository plans are outdated. The initial UI pass did not alter event values or mechanics. The later continuous-world pass changes outcome resolution as documented in game3-continuous-world.md.


## Continuous-world artwork

The later design replaces the default card screen with one continuous dynasty world. These assets were generated with the built-in image_gen tool and resized with sips, preserving transparency for sprites:

- `public/arts/v3-ui/battlefield.jpg`: shared walkable ground.
- `public/arts/v3-ui/general.png`: player avatar (512 px, alpha preserved).
- `public/arts/v3-ui/settlements.png`: four-building atlas (1024 px, alpha preserved).

The earlier `dynasty-dawn.jpg` remains the lobby artwork. All full-size originals remain in Codex's generated_images directory rather than in public/arts.

### Ground prompt

Use case: stylized-concept. Asset type: production top-down 2D action game battlefield ground plate, landscape 1536x1024. Strict overhead orthographic camera looking straight down at a broad ancient Chinese frontier military field, worn mossy earth and dusty pale paths making a triangle between three round open flagstone clearings at approximately (25 percent, 30 percent), (75 percent, 30 percent), (50 percent, 75 percent). Entire center wide open walkable ground, generous quiet flat areas for moving characters. Rich hand painted realistic game texture, muted dark jade grass, warm brown earth, desaturated stone, subtle burnt patches and faint cart tracks. Small ornamental shrubs, rocks and fallen leaves only around extreme outside edges. Directional soft afternoon light, restrained painterly detail readable at small scale, premium historical action RPG environment. No perspective horizon, no buildings, no roofs, no people, no animals, no text, no symbols, no UI, no deep water or inaccessible terrain. Flat traversable continuous ground.

### General prompt

Use case: stylized-concept. Asset type: single transparent-background character sprite for top-down historical Chinese action RPG. Full-body original Chinese general in dark jade lamellar armor with antique gold edging, flowing deep vermilion shoulder cape, black topknot with red tassel, bronze shoulder guards and dark boots, holding a long steel dao saber in right hand. Viewed from above at a steep 55 degree angle, three-quarter facing down and right. Painterly premium 2D game rendering, strong clear silhouette, readable armor shapes, controlled realistic detail, soft highlights. One character only centered with whole weapon and feet visible and generous transparent margins. Actual transparent background, no ground, no cast shadow, no border, no words, no logos. Not a portrait, not a scene, no extra figures.

### Settlement prompt

Use case: stylized-concept. Asset type: transparent sprite atlas for original historical Chinese top-down RPG. Exactly four isolated hand-painted miniature building sprites arranged in an evenly spaced 2 by 2 grid, each completely contained in its own equal-size quadrant with wide transparent padding, no overlap. Top left: frontier stone gatehouse with dark tiled Chinese roof and two vermilion standards. Top right: refined Chinese magistrate hall with jade gray tiled roof and open wooden veranda. Bottom left: rustic wooden granary with straw grain sacks and tiled roof. Bottom right: humble Chinese village courtyard house with clay walls, gray tiles and a small tree. Orthographic three quarter overhead game camera, overhead at steep 55 degree angle, all same lighting and scale, realistic painterly historical game environment props, aged stone and wood, desaturated jade and earth colors with restrained gold and red. Actual transparent background across entire atlas including between sprites. No terrain, no ground plane, no labels, no text, no frames, no UI. Wide landscape canvas 1536x1024, quadrants exactly equal.


## 2026-09-13: materials and readable play space

This pass changes the actual 3D renderer. It does not replace Claude's event, collision, combat, economy, or village-state logic.

Implemented:

- Six generated 512 × 512 JPEG textures: `public/arts/v3-ui/stone-v1.jpg`, `timber-v1.jpg`, `tiles-v1.jpg`, `plaster-v1.jpg`, `grass-v1.jpg`, and `earth-v1.jpg` (all in that same directory). The first four wrap 3D buildings; grass and earth are composited along the real road layout. Loading terrain images does not block movement; painted ground remains if they fail.
- Closer default camera (distance 21, pitch 0.76 radians), retained orbit/zoom controls and wall fading. Portrait screens retain a steeper angle.
- The gate has spear racks and shields; the granary has loading platforms and bound sacks; halls have physical notices; houses have pottery and stored firewood; the altar has offering bowls and incense. Details stay within building collision envelopes and leave roads open.
- The commander has lamellar plates, a headband and red plume. Carrying an existing delivery now displays a sack, medicine box, or document bundle in the character's arms. These are visual reflections of existing order state.
- Architecture detail lives in `src/game3/action/districtArt.ts`. Integrations are in `render3d.ts` and `models3d.ts`. Existing villagers, changes after choices, and all outcome rules remain owned by the shared gameplay implementation.

These are runtime textures on stylized models, not a claim of finished realistic characters or final animation quality. The older battlefield/general/settlements sprites belong to the 2D fallback; replacing those images would not improve the active WebGL scene.

### Next gameplay design: make decisions worth playing

Design proposals for the logic work, **not implemented by this visual pass**. Keep all of these in the same village and let consequences survive the next event.

| Activity | Player decision and skill | Visual promise | Lasting consequence |
| --- | --- | --- | --- |
| Capture a pass | Read archer lines, dodge the volley, flank or push with allies, hold the banner position | Shields and spear racks at the gate; clear attack warnings; an ownership banner | Friendly patrols and a safer supply road; losing leaves damage and survivors |
| Escort provisions | Choose when to advance or regroup around the cart; protect its porter and intercept attackers | A loaded moving cart, rolling wheels, readable damage, unloading on arrival | More market stock and visible provisions; losses leave a wreck and scarcity |
| Distribute relief | Choose the order of households and how to divide limited aid, rather than repeat an identical delivery three times | Cargo held in the arms; an identifiable household and a person awaiting it | Residents recover, a kitchen or clinic appears, and later dialogue remembers who received help |
| Govern a dispute | Listen to different interests, gather a relevant fact in the village, then commit to a compromise | A noticeboard, identifiable officials and residents, a gathering at the relevant site | A useful policy opens an activity; an unpopular policy changes crowds and cooperation |
| Found a dynasty | Secure support and resources through the world, then complete the public ceremony | A prepared altar, gathered witnesses, banners and offerings | A visible settlement upgrade and a new pressure to manage |

Priorities:

1. **First minute:** a nearby person needs help, the player learns move/interact/dodge in context, and one small success visibly changes the street. Keep long political exposition until the player has done something.
2. **Readable actions:** show one destination and the next action, indicate attack timing before damage, and make cargo and completion visible on the character or location. Offer clear failure recovery instead of silently undoing progress.
3. **Variety within events:** the five activity families are a foundation. Distinct events still need different pressures, routes, participants and tradeoffs; unique illustrations alone will not prevent repetition.
4. **Reward with access:** repairs, allies, safer roads, useful services and changed NPC reactions should matter alongside the four resource bands. Revisit the same location and recognize what your decision did.
5. **Feel before scale:** tune movement, collisions, combat response, readable hit feedback and actual-device frame pacing before enlarging the map. Test on a phone and ordinary laptop; headless WebGL performance cannot establish device performance.

Suggested playtest acceptance: a new player can find the first objective without explanation; identify the next action; distinguish hostile warnings from mission markers; finish an activity; and point to a persistent change afterward. Ask where they felt confused or bored and watch behavior rather than relying only on whether they say it looks better.

### Verification of this pass

- `npm run build`: passes type checking and all three production builds. The existing large JavaScript chunk warning remains.
- `.claude/skills/verify/smoke.mjs`: all three games start, accept input and report no console errors.
- `.claude/skills/verify/world.mjs`: passes movement, camera-relative controls, solid buildings, pause, all five activities, success/failure outcomes and persistent village changes.
- Local browser visual checks at 1280 × 850 and 390 × 850: textured terrain loaded, movement and camera orbit worked, no console errors or horizontal overflow. Screenshots were inspected.
- An isolated local renderer check confirmed exactly one correct carried-item model for grain, medicine and documents, hiding it after delivery, and clean teardown. This harness is not shipped.
- Six runtime textures total 502,957 bytes. Changes are local; this pass does not publish to GitHub Pages. Real-device frame-rate testing and player enjoyment testing remain outstanding.

### Generation record

Mode: built-in `image_gen`, two new atlas generations; no reference image. Originals remain in Codex's generated_images directory. The selected atlases were cropped and resized with local browser Canvas to individual 512 px JPEGs, then saved in the runtime directory above. No standalone scene painting is used as the 3D world.

Building atlas prompt:

> Use case: stylized-concept.
> Asset type: a production 2x2 square material atlas for an original playable 3D Chinese dynasty village game, not concept art.
> Create exactly four equal square texture swatches filling the entire square image edge to edge, with boundaries exactly at 50% horizontally and vertically. Top left: weathered grey-brown stone masonry, staggered rectangular stones and fine mortar joints, about 6 courses. Top right: aged warm dark brown timber boards, fine vertical wood grain, 6 vertical planks. Bottom left: muted blue-grey fired clay Chinese roof tiles, small overlapping curved tile rows, 8 rows. Bottom right: warm ivory lime plaster, fine cracks, mild patina and worn patches, no masonry.
> Style: realistic hand-crafted game environment surfaces with restrained detail, tactile and believable rather than cartoon, all four compatible in scale and understated palette. Straight-on orthographic flat albedo scans, uniform diffuse neutral light, no perspective or baked directional cast shadows. Each quadrant should repeat as naturally as possible on its own. No borders, gaps, labels, characters, text, objects, buildings, logos, or watermark. Square image.

Terrain atlas prompt:

> Use case: stylized-concept. Asset type: production terrain albedo texture atlas for an original 3D Chinese dynasty village game. Exactly two equal square swatches side by side, full image 2:1 landscape, dividing boundary exactly at midpoint. LEFT half: realistic short patchy dry olive green grass, tiny blades, a little exposed dusty soil, fine fallen organic matter, no large plants. RIGHT half: realistic compacted dusty grey brown earth of an ancient village footpath, mottled fine grit, occasional very small gravel, subtle wear; no grass. Orthographic straight-down scan, even flat diffuse light, no perspective or baked shadows. Restrained earthy colors, realistic game material detail at ground level. Each half should tile naturally on its own, no large distinctive features, no path outline, no borders, labels, text, objects, people or UI.
