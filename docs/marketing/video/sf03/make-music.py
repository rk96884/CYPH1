"""Original, deterministic restrained electronic underscore and pulse SFX."""
from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RATE = 44100
DURATION = 23.5
COUNT = round(RATE * DURATION)
random.seed(103)


def tone(t: float, frequency: float) -> float:
    return math.sin(2 * math.pi * frequency * t)


chords = [
    (110.0, 164.81, 220.0),  # A minor
    (87.31, 130.81, 174.61),  # F
    (98.0, 146.83, 196.0),  # G
    (82.41, 123.47, 164.81),  # E minor
]
samples = bytearray()
for i in range(COUNT):
    t = i / RATE
    chord = chords[int(t / 5.875) % len(chords)]
    phase = (t * 1.6) % 1
    pluck = math.exp(-8 * phase)
    pad = sum(tone(t, f) for f in chord) / 3
    low = tone(t, chord[0] / 2) * (0.62 + 0.38 * tone(t, 0.13))
    arp = tone(t, chord[int(t * 3.2) % 3] * 2) * pluck
    beat = (t * 1.6) % 1
    kick = math.sin(2 * math.pi * (72 - 30 * min(beat, 0.15)) * beat) * math.exp(-25 * beat)
    # A wide, non-selective soft pulse at the storyboard's single illustration.
    pulse = 0.0
    if 11.4 <= t < 11.9:
        p = t - 11.4
        pulse = math.sin(2 * math.pi * (480 + 260 * p) * p) * math.exp(-8 * p)
    fade = min(1.0, t / 1.1, (DURATION - t) / 1.25)
    value = fade * (0.055 * pad + 0.026 * low + 0.018 * arp + 0.015 * kick + 0.026 * pulse)
    value = max(-0.9, min(0.9, value))
    samples.extend(struct.pack('<h', round(value * 32767)))

with wave.open(str(ROOT / 'music-and-sfx.wav'), 'wb') as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(RATE)
    audio.writeframes(samples)
