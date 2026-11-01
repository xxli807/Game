# Game3 character asset provenance

`warrior-base.glb` contains a selected and repackaged subset of the free Standard editions below, downloaded from the creator's normal public itch.io download flow on 2026-10-07.

- Quaternius, Universal Base Characters: https://quaternius.com/packs/universalbasecharacters.html — `Superhero_Male_FullBody.gltf`, skeleton, body/eye colour textures and eyebrow geometry.
- Quaternius / Gonzalo Furnier, Universal Animation Library: https://quaternius.com/packs/universalanimationlibrary.html — selected locomotion, combat, hit, roll and death clips.
- Quaternius / Gonzalo Furnier, Universal Animation Library 2: https://quaternius.com/packs/universalanimationlibrary2.html — selected sword combo, recovery, guard and hit clips.

All three downloaded archives include a CC0 1.0 Universal dedication: https://creativecommons.org/publicdomain/zero/1.0/. This asset retains that dedication; the repository's proprietary license does not override it. No paid Source/Pro files are included.

Preparation: `python3 scripts/assets/prepare-v3-warrior.py`. The original ZIPs and extracted source stay in ignored `art-source/v3-warriors/`. The script selects 17 clips, retains the character's proportions, strips unused attributes/maps and packs the result into one GLB. Runtime code supplies original Chinese-inspired clothing/equipment and animation blending. Those additions are not historical uniforms supplied or endorsed by Quaternius.

The original three license notices are included as `*-LICENSE.txt`. Runtime GLB SHA-256: `bd198d31f94d3c89152dada7a0e4cbf1deb8670e5403d090da261714b5e384f5`.

The selected free body uses stylized superhero proportions. Shared skeleton names permit reuse of the library clips while preserving the target's limb translations; this is not a claim of bespoke historical motion capture. Archery uses an additive aiming pose because the selected packs contain no bow clip.
