# V3 playability pass · 2026-10-03

The goal is a vivid dynasty world that rewards judgement, gives clear feedback and makes players curious about the next decision. Both lobby entries remain: **进入天下** for the illustrated chronicle and **Start Playing** for the continuous 3D world.

## Implemented in this pass

- **Negotiate a policy, with real costs.** Representatives discuss military households, supply, commerce or government according to the event. Strong institutions or a proposal that addresses their interests can win support without extra spending. Otherwise, the player can fund at most two promises from the available treasury. Two of three supporters pass the council; declining is valid. The UI previews whether an appeal will work. Each funded promise costs four internal economy points, deducted after outcome modifiers on both success and failure, once per order. The existing qualitative resource display is preserved.
- **Plan a relief route.** Collect all three parcels once, choose destinations from a delivery list and deliver in any order. The minimap uses the actual road network, names each stop and marks completed deliveries. Repair orders name the three walls. The carried-load label tracks remaining parcels.
- **Hear from the people helped.** A nearby recipient speaks immediately when supplies arrive. Household dialogue remembers the delivery, with different responses to medicine, school supplies, funds, repair materials and food. This builds on the existing persistent village buildings and crowds; memory lasts for the current run.
- **Know what the dynasty needs.** A founding checklist in the chronicle and world decision/pause screens uses the same rule as the ending. At least two of military 58, politics 58 and economy 55, plus destiny 38, are required. Meeting them early is preparation; the player must still reach the founding ceremony.
- **Recover from a text-mode reversal.** The first random reversal reduces mandate by six rather than immediately ending a healthy run. If mandate remains below the “稳健” band, the game shows a persistent warning. Recovery to 56 clears it before another random check; another reversal during an unresolved warning can end the run. Mandate zero remains fatal. A dynasty still above the recovery threshold receives a minor-setback message instead of a misleading crisis warning. Monarch abilities are available during text challenges as well as ordinary choices.
- **Let preparation count.** Text challenges now start from their authored odds and apply the existing resource/court modifiers. The former blanket ×0.72 penalty is removed. Cautious options therefore provide a more reliable alternative to high-reward risks. World activities still settle from player performance, without another random failure roll afterward.
- **Give the setting context.** Optional historical notes explain military households and farming, canal supplies and silver taxation. They link to sources and explicitly separate documented institutions from this fictional meeting of rulers and ministers from different eras.

Implementation is concentrated in `ChronicleGuide.tsx`, `action/diplomacy.ts`, the world engine and village, with integration in `App.tsx`. No new artwork is required for these changes; they affect what the player does and what the existing 3D world communicates.

## Historical references

- [Palace Museum: 卫所制度](https://www.dpm.org.cn/court/system/236399.html) — hereditary military households, farming and garrison duties, and institutional decline.
- [Palace Museum Journal: 明代的宫廷运输与运河交通](https://img.dpm.org.cn/Uploads/File/2019/12/15/u5df5ed4ebd0d9.pdf) — supplies and canal transport for the northern capital.
- [Madeleine Zelin, The Magistrate’s Tael, chapter 1](https://publishing.cdlib.org/ucpressebooks/public/book/the-magistrate-s-tael-rationalizing-fiscal-reform-in-eighteenth-century-ch-ing-china.html) — the introduction’s discussion of Ming tax consolidation and commutation into silver; the book’s principal subject is later Qing fiscal reform.

Dialogue, individual promises and resource effects are original game design, not historical quotations or reconstructed incidents.

## Verification

- `npm run build`: whole-repository TypeScript check and all three production builds pass. The existing v3 bundle-size warning remains.
- `node .claude/skills/verify/v3-rules.mjs`: deterministic warning/recovery, challenge preparation, founding boundaries, representative support and treasury-cost checks pass.
- `node .claude/skills/verify/world.mjs`: movement, solid buildings, all five activities, non-default delivery order, no duplicate deliveries, household memory, paid/free negotiation, insufficient funds and budget reset pass. Combat, escort roads and persistent village consequences also pass.
- All-game smoke checks pass, including both v3 entry points, movement and pause/resume, with no console errors.
- An isolated browser UI harness at 1280 and 390 pixels checks real negotiation buttons, keyboard focus, exhausted budgets, exactly-once settlement and horizontal overflow. The real text App retains the warning after a choice and handles a monarch ability consistently with the displayed mandate band. Screenshots were inspected. The harness adds no test globals to production.
- Final text-mode balance check: **45 random campaigns → 9 wins, 36 losses (20%)**, 108 event titles, no template leftovers, no phase mismatches and no console errors. Losses: 23 unresolved crises, eight insufficient foundations, four time limits and one exhausted mandate. The runner chooses randomly and does not use ruler abilities. The test harness now reads ending title and win/loss atomically; earlier passes had intermittent unread titles. This is a difficulty baseline, not a measure of enjoyment or the 3D mode. Text mode remains demanding; the next balance decision should include strategic and human play, rather than tune to one small random sample.

These checks establish functional behavior. Enjoyment, device performance and the duration of a complete 3D campaign still need observation with players on ordinary phones and laptops.

## Next priorities, not implemented here

1. **An opening with a person to care about.** A short authored first event teaches movement and interaction through an urgent, comprehensible local need. Its recipient becomes a recurring character.
2. **Longer consequences.** The October 4 pass below adds three recurring people with outcome-driven requests. Further chapters can connect workshops, repaired roads and disputed requisitions across multiple decisions.
3. **More physical variety within activities.** Supply shortages, alternate escort routes and enemy formations should create different decisions. Adding more illustrations to identical activities will not establish replay value.
4. **Resume a campaign.** Save the event deck, resources, world changes and activity state together, with versioned validation. Saving only the story while resetting the village would break continuity.
5. **Measure the first ten minutes.** Watch whether new players can find a target, understand their options, complete an activity and identify a lasting consequence. Record where they hesitate or stop. Use that evidence to tune pacing before expanding the map.

Replay value should come from different rulers, strategies, consequences and discoverable stories. Automated checks cannot establish that players will want another run.

## Recurring characters and playable follow-ups · 2026-10-04

Implemented for **Start Playing** in the same continuous village:

| Character | What actually triggers the request | Playable branches | Lasting result |
| --- | --- | --- | --- |
| 沈桥, carpenter | A successful main relief mission | Deliver school supplies or deliver timber to three wall sections | A school or repaired walls; his later conversation recalls the chosen branch |
| 许安, caravan leader | A completed main escort, including failure | After success, escort goods or returning households; after failure, fight to recover goods or escort the households | Market supplies or settlers; recovered goods also appear after the recovery fight |
| 林晚, healer | Successful medicine delivery or a failed main assault | Distribute further medicine or escort carers and their families | A clinic or new households; dialogue acknowledges whether the follow-up succeeded |

Each request appears after the next main decision loads. The contact list **乡里人情** marks available requests and can guide the player to the actual person; names appear over their 3D models and on the minimap. The fallback renderer also draws named characters. Their identities and memories survive changes to the generic crowd.

Requests can be deferred. Accepting one starts a real relief, escort or combat activity using the existing world engine. One branch per character can be completed per run; failed follow-ups record failure rather than falsely thanking the player for success. Side missions do not generate more copies of themselves or advance/settle the waiting dynasty event. Returning to the person recalls the result; the pause journal also records completed local stories. Progress still lasts for the current run only.

These are original fictional villagers. This pass adds no new historical claims, no generated portraits, and no changes to four-pillar rewards, text-mode odds or founding requirements. Branch rewards are visible village changes, with the existing activity risks. It does not add chapter chains beyond these three requests or save/resume.

Implementation: `action/stories.ts` owns request eligibility, mutually exclusive choices and memories; `Village` owns the recurring people; the engine executes activities; `StoryDialog.tsx` and `World.tsx` show choices, tracking and journal entries. `App.tsx` does not need a new story callback.

Verification commands:

```sh
node .claude/skills/verify/v3-stories.mjs
node .claude/skills/verify/world.mjs
node .claude/skills/verify/v3-story-ui.mjs
npm run build
node .claude/skills/verify/smoke.mjs
```

The rule checks cover both convoy outcomes, delayed availability, failure memories, exclusive branches, replay prevention and named-person persistence. The engine test walks a school mission and verifies that its building remains while the original event and turn remain unchanged. The UI harness covers tracking, deferral, keyboard focus, mission completion and journal results at desktop/mobile sizes and in the 2D fallback. Screenshots are written to `/tmp/v3-stories`; harness controls are never shipped in production.

## Two opposing armies · 2026-10-04

**Start Playing → 出城迎战** now starts an immediate playable sortie; the same action is available from the main conversation. The commander enters the open ground beside the gate. Ten allied infantry/archers face twelve enemy infantry, archers and heavy troops. Assault missions use these opposing formations too. Allies move, select targets, attack and take damage; enemy soldiers and arrows can hit allies instead of only pursuing the player.

WASD moves the commander, Space dodges, Q breaks a nearby formation and R fires arrows. Army orders are **1 advance / 2 follow / 3 hold**, also available as touch buttons. Holding records each soldier’s current position; following lets the player redirect the formation. Victory requires defeating the enemy and taking the gate flag. A separate sortie returns to the waiting main decision on either outcome; it does not settle an unchosen dialogue option. One separate sortie is available per main turn, preventing repeated garrison rewards. Normal assault results still resolve their original event.

The live 3D scene has teal/red uniforms and standards, allied health bars, a commander label, animated melee and ranged attacks, shields, instanced armour plates, quivers, sparks and brief falling animations. Camera focus snaps across the sortie transition so the commander does not remain hidden behind the previous village view. Portrait battle views ease farther out to show both lines while retaining pinch zoom. These are additions to the existing stylized models and materials; no new bitmap art or photorealistic character assets were generated. Actual-device frame-rate checks remain useful with the larger troop count.

`action/army.ts` owns allied formation behavior; the engine owns damage, commands and mission results. `verify/v3-army.mjs` checks dialogue-to-combat transition, both sides taking damage, commands, pause, victory/capture, defeat and safe campaign return. Desktop/mobile browser checks exercise the prominent battle button, army commands, skills and pause. The existing world regression still covers escorts, council, relief, ceremony and character follow-ups.

## Manual melee and battlefield art · 2026-10-05

The previous encounter used instant automatic damage, oversized heads and rigid limbs; both armies converged on the same target. This pass changes the interaction and the live models together:

- **J / 挥刀** is a manual three-strike combo. Holding it repeats; each swing has a wind-up, one contact window and recovery. The third strike breaks a frontal shield. Facing away or dodging before contact can miss/cancel a strike.
- **K / 招架** holds a directional guard and spends stamina. A frontal hit in the first 0.23 seconds is parried and opens a 1.1-second counterattack; late guards reduce damage, rear attacks bypass them, and exhaustion drops the guard. Pausing or losing focus releases inputs.
- Infantry carry long spears and shields, spread target selection across the opposing line and attack after a visible preparation. Archers stand farther behind and retreat from nearby opponents. Holding a line improves allied frontal protection. R orders arrows from living allied archers; without archers the commander supplies the volley.
- `warriors3d.ts` supplies original segmented armour, cheek/nape guards, cloth, weapon shapes, elbow/knee joints and separate melee/bow poses. Static model parts merge by material within each articulated segment. The heavy infantry remains a normal-sized human with heavier equipment.
- Thin weapon trails, wood-coloured arrows with heads/fletching, low battlefield dust, softer shadows, fuller tree crowns, impact recoil and drum/gong/metal sound cues replace some of the earlier abstract effects. The battle camera follows both commander and nearby enemy line. Mobile commands occupy less of the view; attack and guard have dedicated touch buttons and a stamina readout.

The army count remains ten versus twelve. These are procedural 3D assets and animation, not motion capture or photorealistic production characters. Actual phone GPU performance and human playtesting are still needed; browser layout and logic checks cannot establish subjective quality or enjoyment. No event/resource numbers or text-mode balance changed in this pass.

Historical art references (high-level forms only; no museum images are copied into the game): [Met, Chinese helmet](https://www.metmuseum.org/art/collection/search/24963), [Met, late Yuan/early Ming helmet](https://www.metmuseum.org/art/collection/search/26917), [Smithsonian, Western Han spearhead](https://www.si.edu/object/spear-head%3Afsg_FSC-B-605). These objects belong to different periods; the game's equipment is deliberately labelled a broad Chinese historical interpretation, not one dynasty's reconstructed uniform.

Validation: `v3-melee.mjs` covers manual input, contact timing, single-hit recovery, combo shield break, arc misses, dodge cancellation, timed/late/rear guards, stamina and pause cleanup. `v3-army.mjs` covers real allied fighting, commands and battle outcomes. `world.mjs` also covers the escort ambush with manual attacks. Desktop/mobile UI checks exercise the combat buttons and inspect actual rendered screenshots.


## 3D campaign difficulty, first measurement · 2026-10-21

Earlier passes recorded text-mode balance but noted the 3D campaign had never been measured end to end. `verify/v3-campaign.mjs` now does that: it mounts the real `App` in an isolated page, plays complete **Start Playing** campaigns, and settles each world activity with probability *p* — the chance a simulated player completes an activity. It reuses one page and the 2D fallback renderer for speed; rules are identical.

**The finding.** Win rate collapsed off a cliff:

| activity success | before | after |
| --- | --- | --- |
| 100% | 89% | 90% |
| 90% | 50% | **70%** |
| 80% | 20% | **50%** |
| 70% | 0% | 0% |
| 50% | — | 0% |

A player who completed 9 activities out of 10 won only half the time, and 8 out of 10 won 20%. Two slips ended a campaign. At 80% success, five of ten losses were 时局已失 — the clock, not the dynasty.

**Two causes, both fixed.**

1. `App.tsx` replaced the whole effect on a failed non-military activity with a flat `-6 politics / -6 economy / -4 destiny`, ignoring the size of the attempt and the player's position. This is now `activityFailure` in `rules.ts`: positive gains are lost (you did not achieve it), authored costs are still paid, and the setback scales down as the realm grows stronger. A strong state absorbs one slip; a weak one does not.
2. A crisis charged 25 seconds on top of the resources it already took, so one failure was punished twice and pushed runs into the time limit. Now 12. Time-limit losses fell from five in ten to one in ten at 80% success.

The sampled perfect-activity completion case remained near 90%; these small batches do not establish an unchanged difficulty ceiling. The failed-activity branch only runs when `outcome === false`, but the shorter crisis time penalty also applies to text mode. The earlier text-mode sample was **9 wins / 36 losses (20%)**, with 108 titles, no template leftovers and no phase mismatches; current release validation is recorded below.

**Still open.** The 0.8 → 0.7 step is still steep (50% to 0%), and n=10 per point is small. Nobody has measured what success rate a real person achieves at these activities, which decides whether 0.7 matters. Council is the one activity that can fail for non-skill reasons (it needs two of three supporters and enough treasury), so it is the first place to look if human play lands below 0.8.

## Release validation · 2026-11-01

The text-mode random-choice run completed 45 campaigns: 13 wins / 32 defeats / 0 sudden-death category, 29% wins. It covered 107 titles with no phase mismatches, template leftovers or console errors. The prior 20% sample is retained above; the runs are unseeded and this difference is not evidence of an improvement by itself.

After preventing failed activities from granting spouse, talent or army upgrades, the campaign harness completed all 30 runs with no browser errors: p=1 gave 7/10 wins; p=0.9 gave 6/10; p=0.8 gave 1/10. These are random choices with simulated activity outcomes, not measured human skill or 3D frame-rate tests. The difficulty remains unforgiving in the p=0.8 sample and the earlier 50% result should not be treated as a stable baseline. The harness now fails if any campaign misses its ending or produces a browser error.
