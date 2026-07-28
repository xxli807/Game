"""Slice generated Mage animation sheets into transparent runtime frames."""

from pathlib import Path
from shutil import copyfile

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ARTS = ROOT / "public" / "arts"
CONCEPTS = ARTS / "concepts"


def slice_sheet(source_name: str, output_prefix: str, columns: int, rows: int) -> None:
    source = CONCEPTS / source_name
    with Image.open(source).convert("RGBA") as sheet:
        frame_number = 1
        for row in range(rows):
            top = round(row * sheet.height / rows)
            bottom = round((row + 1) * sheet.height / rows)
            for column in range(columns):
                left = round(column * sheet.width / columns)
                right = round((column + 1) * sheet.width / columns)
                frame = sheet.crop((left, top, right, bottom))
                alpha_bounds = frame.getchannel("A").getbbox()
                if alpha_bounds is None:
                    raise RuntimeError(f"{source_name} frame {frame_number} is empty")
                frame = frame.crop(alpha_bounds)
                padded = Image.new("RGBA", (frame.width + 12, frame.height + 12))
                padded.alpha_composite(frame, (6, 6))
                padded.save(ARTS / f"{output_prefix}_{frame_number}.png", optimize=True)
                frame_number += 1


def main() -> None:
    slice_sheet("mage_turn_sheet.png", "hero_mage_turn", 4, 1)
    slice_sheet("mage_attack_sheet.png", "hero_mage_attack", 3, 2)
    for direction in ("s", "e", "ne", "se", "up"):
        slice_sheet(f"mage_walk_{direction}_sheet.png", f"hero_mage_walk_{direction}", 4, 2)

    copyfile(CONCEPTS / "mage_turn_sheet.png", ARTS / "hero_mage_turn_sheet.png")
    copyfile(CONCEPTS / "mage_attack_sheet.png", ARTS / "hero_mage_attack_sheet.png")

    # Directional aliases mirror the Warrior asset naming convention.
    copyfile(ARTS / "hero_mage_turn_1.png", ARTS / "hero_mage_down.png")
    copyfile(ARTS / "hero_mage_turn_3.png", ARTS / "hero_mage_side.png")
    copyfile(ARTS / "hero_mage_turn_4.png", ARTS / "hero_mage_up.png")


if __name__ == "__main__":
    main()
