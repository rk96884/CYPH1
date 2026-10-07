import sharp from "sharp";
import { resolve } from "node:path";

// Pixel-only crops of the supplied 1536 × 1024 master; no resizing or retouching.
const source = process.argv[2];
if (!source) throw new Error("Pass the supplied collage PNG path.");
const metadata = await sharp(source).metadata();
if (metadata.width !== 1536 || metadata.height !== 1024) throw new Error("Crop coordinates require the approved 1536 × 1024 master.");
// Treatment areas now uses a separately supplied approved image; preserve it.
const panels = [
  ["cyph1-ipl-hero-v1.png", 0, 0, 379, 453],
  ["cyph1-ipl-whats-included.png", 389, 0, 378, 454],
  ["cyph1-ipl-cooling.png", 775, 0, 377, 455],
  ["cyph1-ipl-technology.png", 0, 512, 528, 445],
  ["cyph1-ipl-at-home.png", 539, 513, 497, 445],
  ["cyph1-ipl-design.png", 1046, 514, 490, 445],
];
for (const [filename, left, top, width, height] of panels) {
  const crop = sharp(source).extract({ left, top, width, height });
  const expected = await crop.clone().raw().toBuffer();
  const output = resolve("src/assets/products/ipl", filename);
  await crop.png().toFile(output);
  const actual = await sharp(output).raw().toBuffer();
  if (!expected.equals(actual)) throw new Error(`Pixel verification failed: ${filename}`);
  console.log(`${filename}: ${width} × ${height}; source pixels verified`);
}
