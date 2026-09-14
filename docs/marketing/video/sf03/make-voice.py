"""Generate SF-03 narration. Install edge-tts into build/edge-tts first."""

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "build" / "edge-tts"))

import edge_tts  # noqa: E402


LINES = [
    ("01-hook.mp3", "IPL does not identify an individual hair's phase."),
    ("02-asynchronous.mp3", "Different hairs can be at different points in the cycle."),
    ("03-repeat.mp3", "That is why treatment is repeated over time."),
    ("04-routine.mp3", "A considered routine, not a shortcut."),
    # Explicit spoken pronunciation: CYPH/1 = “Sife One”, never C-Y-P-H.
    ("05-lockup.mp3", "Sife One. Know the cycle."),
]


async def main() -> None:
    output = Path(__file__).parent / "voice"
    output.mkdir(exist_ok=True)
    for filename, text in LINES:
        narration = edge_tts.Communicate(text, voice="en-GB-SoniaNeural", rate="-8%")
        await narration.save(str(output / filename))
        print(filename)


if __name__ == "__main__":
    asyncio.run(main())
