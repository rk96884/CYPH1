import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "public/brand/source/cyph1-approved-logo-direction.svg");
const outputDirectory = resolve(root, "public/brand/generated");
const source = await readFile(sourcePath, "utf8");

if (/<(?:script|image|foreignObject)\b/i.test(source) || /(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i.test(source)) {
  throw new Error("Logo source contains unsupported active or external content.");
}

const withoutBackground = source.replace(/<path\s+d="M0 0 C506\.88[\s\S]*?fill="#020202"\s+transform="translate\(0,0\)"\/>\s*/, "");

function frame(svg, viewBox) {
  return svg.replace(
    /<svg version="1\.1" xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1536" height="1024">/,
    `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-labelledby="title desc"><title id="title">CYPH/1</title><desc id="desc">CYPH/1 logo with a hair and follicle symbol replacing the slash.</desc>`,
  );
}

function rgb(hex) {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
}

function flatColour(hex) {
  const [red, green, blue] = rgb(hex);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  if (luminance < 0.16) return "none";
  if (blue > red && saturation > 0.16) return "#A77AF4";
  return "#F7F3F8";
}

function recolour(svg, mode) {
  return svg.replace(/<path\b([^>]*?)fill="(#[0-9A-Fa-f]{6})"([^>]*?)\/>/g, (_path, before, fill, after) => {
    const luminance = rgb(fill).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0) / 255;
    let replacement;
    if (mode === "flat") replacement = flatColour(fill);
    else if (luminance < 0.16) replacement = "none";
    else replacement = mode === "dark" ? "#0B0710" : "#F7F3F8";
    return replacement === "none" ? "" : `<path${before}fill="${replacement}"${after}/>`;
  });
}

function addBackground(svg, viewBox, fill) {
  const [, , width, height] = viewBox.split(" ").map(Number);
  const [x, y] = viewBox.split(" ").map(Number);
  return svg.replace(/(<desc[^>]*>.*?<\/desc>)/, `$1<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`);
}

const lockupBox = "110 245 1315 420";
const wordmarkBox = "110 245 1315 330";
const markBox = "1045 255 205 315";

const variants = {
  "cyph1-lockup-metallic.svg": frame(withoutBackground, lockupBox),
  "cyph1-lockup-flat.svg": frame(recolour(withoutBackground, "flat"), lockupBox),
  "cyph1-wordmark-metallic.svg": frame(withoutBackground, wordmarkBox),
  "cyph1-wordmark-light.svg": frame(recolour(withoutBackground, "light"), wordmarkBox),
  "cyph1-wordmark-dark.svg": frame(recolour(withoutBackground, "dark"), wordmarkBox),
  "cyph1-mark-metallic.svg": frame(withoutBackground, markBox),
  "cyph1-mark-light.svg": frame(recolour(withoutBackground, "light"), markBox),
  "cyph1-mark-dark.svg": frame(recolour(withoutBackground, "dark"), markBox),
};

variants["cyph1-lockup-presentation.svg"] = addBackground(variants["cyph1-lockup-metallic.svg"], lockupBox, "#020202");
variants["cyph1-favicon.svg"] = addBackground(variants["cyph1-mark-metallic.svg"], markBox, "#0B0710");

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  Object.entries(variants).map(async ([name, content]) => {
    const path = resolve(outputDirectory, name);
    if (dirname(path) !== outputDirectory) throw new Error("Unexpected output path.");
    await writeFile(path, content, "utf8");
  }),
);

console.log(`Built ${Object.keys(variants).length} logo variants from the approved source.`);
