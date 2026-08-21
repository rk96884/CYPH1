import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "public/brand/source/cyph1-approved-logo-direction.svg");
const outputDirectory = resolve(root, "public/brand/generated");
const source = await readFile(sourcePath, "utf8");
const paths = [...source.matchAll(/<path\s+d="([^"]+)"[^>]*fill="(#[0-9A-Fa-f]{6})"[^>]*transform="([^"]+)"\/>/g)];

// The first seven artwork paths after the traced background are the complete
// silhouettes for H, P, C, Y, 1, the hair and the follicle. Later paths are
// small trace fragments that simulate highlights and create rough edges.
const silhouettes = paths.slice(1, 8);
if (silhouettes.length !== 7) throw new Error("Unexpected approved logo structure.");

const pathMarkup = (mode) => silhouettes.map((match, index) => {
  const [, d, , transform] = match;
  const isAccent = index >= 4;
  const fill = mode === "flat"
    ? (isAccent ? "#A77AF4" : "#F7F3F8")
    : (isAccent ? "url(#violetMetal)" : "url(#silverMetal)");
  return `<path d="${d}" fill="${fill}" transform="${transform}"/>`;
}).join("");

const definitions = `<defs>
  <style>@font-face{font-family:Michroma;src:url("../../fonts/michroma-latin.woff2") format("woff2");font-weight:400;font-style:normal}</style>
  <linearGradient id="silverMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.5" stop-color="#D8D7D9"/><stop offset="1" stop-color="#F3F0F5"/></linearGradient>
  <linearGradient id="violetMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E0CCFA"/><stop offset="0.48" stop-color="#A77AF4"/><stop offset="1" stop-color="#7750B5"/></linearGradient>
</defs>`;

const build = (mode, lockup = false) => {
  const descriptorFill = mode === "flat" ? "#A77AF4" : "#C5A2F7";
  const descriptor = lockup ? `<text x="792" y="635" fill="${descriptorFill}" font-family="Michroma, Arial, sans-serif" font-size="58" letter-spacing="12" text-anchor="middle">CYCLE. PHASE. ONE.</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="110 245 1315 ${lockup ? 420 : 330}" role="img" aria-labelledby="title desc" shape-rendering="geometricPrecision"><title id="title">CYPH/1</title><desc id="desc">CYPH/1 logo with a hair and follicle symbol replacing the slash.</desc>${definitions}${pathMarkup(mode)}${descriptor}</svg>`;
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "cyph1-wordmark-clean-metallic.svg"), build("metallic"), "utf8");
await writeFile(resolve(outputDirectory, "cyph1-wordmark-clean-flat.svg"), build("flat"), "utf8");
await writeFile(resolve(outputDirectory, "cyph1-lockup-clean-metallic.svg"), build("metallic", true), "utf8");
await writeFile(resolve(outputDirectory, "cyph1-lockup-clean-flat.svg"), build("flat", true), "utf8");
console.log("Built four cleaned logo variants without altering the approved source.");
