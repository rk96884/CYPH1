import { readFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

// Reuse the approved raster lock-up and the website's existing social artwork.
const output = new URL("../public/brand/email/", import.meta.url);
await mkdir(output, { recursive: true });
await sharp(fileURLToPath(new URL("../public/brand/reference/cyph1-lockup-clean-flat-preview.png", import.meta.url)))
  .resize({ width: 720 }).png().toFile(fileURLToPath(new URL("cyph1-lockup.png", output)));
const footer = await readFile(new URL("../src/components/Footer.astro", import.meta.url), "utf8");
for (const match of footer.matchAll(/<symbol id="social-([^"]+)"[^>]*>(.*?)<\/symbol>/gs)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#b78af2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><style>.social-fill{fill:#b78af2;stroke:none}</style>${match[2]}</svg>`;
  await sharp(Buffer.from(svg)).resize(72, 72).png().toFile(fileURLToPath(new URL(`${match[1]}.png`, output)));
}
