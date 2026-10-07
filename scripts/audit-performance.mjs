import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

export const INITIAL_BUDGET = 200 * 1024;
// Cold-cache estimates at the supported layouts, including high-density displays.
export const SCENARIOS = [320, 430, 768, 1366, 1920].flatMap(width => [1, 2].map(dpr => ({ width, dpr })));
const origin = "https://audit.invalid";
const decode = value => value.replaceAll("&amp;", "&").replaceAll("&quot;", '"');
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m => [m[1].toLowerCase(), decode(m[2] ?? m[3] ?? m[4])]));
const split = value => {
  let depth = 0, start = 0; const parts = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    if (value[i] === ")") depth--;
    if (value[i] === "," && depth === 0) { parts.push(value.slice(start, i).trim()); start = i + 1; }
  }
  return [...parts, value.slice(start).trim()];
};

// Deliberately bounded CSS length evaluator: no eval(), and unsupported sizes fail
// visibly instead of silently charging an arbitrary fallback image.
export function lengthPixels(input, width) {
  const tokens = input.match(/\d*\.?\d+(?:px|rem|em|vw)?|[a-z]+|[()+*/,-]/gi) ?? [];
  if (tokens.join("").toLowerCase() !== input.replace(/\s/g, "").toLowerCase()) throw new Error(`Unsupported image size: ${input}`);
  let i = 0;
  const primary = () => {
    const token = tokens[i++];
    if (token === "-") return -primary();
    if (token === "+") return primary();
    if (token === "(") { const n = sum(); if (tokens[i++] !== ")") throw new Error("Unclosed size expression"); return n; }
    if (/^(calc|min|max|clamp)$/i.test(token ?? "")) {
      if (tokens[i++] !== "(") throw new Error("Invalid size function");
      const values = [sum()]; while (tokens[i] === ",") { i++; values.push(sum()); }
      if (tokens[i++] !== ")") throw new Error("Unclosed size function");
      if (token === "calc" && values.length === 1) return values[0];
      if (token === "min") return Math.min(...values);
      if (token === "max") return Math.max(...values);
      if (token === "clamp" && values.length === 3) return Math.max(values[0], Math.min(values[1], values[2]));
      throw new Error(`Invalid size function: ${token}`);
    }
    const match = token?.match(/^(\d*\.?\d+)(px|rem|em|vw)?$/i);
    if (!match) throw new Error(`Invalid size token: ${token}`);
    return Number(match[1]) * (match[2] === "vw" ? width / 100 : ["rem", "em"].includes(match[2]) ? 16 : 1);
  };
  const product = () => { let n = primary(); while (["*", "/"].includes(tokens[i])) { const op = tokens[i++], next = primary(); n = op === "*" ? n * next : n / next; } return n; };
  const sum = () => { let n = product(); while (["+", "-"].includes(tokens[i])) { const op = tokens[i++], next = product(); n = op === "+" ? n + next : n - next; } return n; };
  const result = sum();
  if (i !== tokens.length || !Number.isFinite(result) || result < 0) throw new Error(`Invalid image size: ${input}`);
  return result;
}

function mediaMatches(media, width) {
  if (!media || media === "all" || media === "screen") return true;
  return split(media).some(part => {
    const conditions = [...part.matchAll(/\((min|max)-width:\s*([^()]+)\)/g)];
    if (!conditions.length || part.replace(/\((min|max)-width:\s*([^()]+)\)/g, "").replace(/\b(?:and|screen)\b|\s/g, "")) throw new Error(`Unsupported resource media: ${media}`);
    return conditions.every(([, bound, value]) => bound === "min" ? width >= lengthPixels(value, width) : width <= lengthPixels(value, width));
  });
}

export function selectImage(attributes, scenario) {
  const srcset = attributes.srcset ?? attributes.imagesrcset;
  if (!srcset) return attributes.src ?? attributes.href;
  const candidates = split(srcset).map(entry => {
    const m = entry.match(/^(\S+)\s+(\d*\.?\d+)(w|x)$/);
    if (!m) throw new Error(`Unsupported srcset candidate: ${entry}`);
    return { url: m[1], size: Number(m[2]), unit: m[3] };
  }).sort((a, b) => a.size - b.size);
  if (new Set(candidates.map(c => c.unit)).size !== 1) throw new Error("Mixed srcset descriptors");
  let slot = scenario.width;
  if (candidates[0].unit === "w") {
    for (const entry of split(attributes.sizes ?? attributes.imagesizes ?? "100vw")) {
      const m = entry.match(/^(\((?:min|max)-width:\s*[^)]+\))\s+(.+)$/);
      if (!m || mediaMatches(m[1], scenario.width)) { slot = lengthPixels(m ? m[2] : entry, scenario.width); break; }
    }
  }
  const target = candidates[0].unit === "w" ? slot * scenario.dpr : scenario.dpr;
  return (candidates.find(c => c.size >= target) ?? candidates.at(-1)).url;
}

export async function auditPerformance(distPath, scenarios = SCENARIOS) {
  const dist = resolve(distPath);
  const files = (await readdir(dist, { recursive: true })).map(file => file.replaceAll("\\", "/"));
  const documents = files.filter(file => file.endsWith(".html")).sort();
  const cache = new Map(), diagnostics = new Set(), errors = [];
  const local = (url, from) => {
    if (!url || /^(?:data:|blob:|#)/i.test(url)) return undefined;
    const parsed = new URL(decode(url), new URL(from.replaceAll("\\", "/"), origin + "/"));
    if (parsed.origin !== origin) return undefined;
    const path = decodeURIComponent(parsed.pathname).replace(/^\//, "");
    const file = resolve(dist, path);
    if (relative(dist, file).startsWith("..")) throw new Error(`Resource outside dist: ${url}`);
    return path;
  };
  const resource = async path => {
    if (!cache.has(path)) {
      const content = await readFile(join(dist, path));
      cache.set(path, { path, raw: content.length, gzip: gzipSync(content).length, content });
    }
    return cache.get(path);
  };
  const add = async (set, url, from, required = true) => {
    const path = local(url, from); if (!path) return;
    try { if (!(await stat(join(dist, path))).isFile()) { if (required) throw new Error("not a file"); return; } }
    catch (error) { if (required) throw new Error(`Missing load-bearing resource ${url} in ${from}: ${error.message}`); return; }
    diagnostics.add(path);
    if (set.has(path)) return;
    set.add(path);
    const item = await resource(path);
    if (path.endsWith(".css")) {
      // Conservative dependency closure: includes CSS fonts/backgrounds/imports.
      for (const m of item.content.toString().matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)|@import\s+["']([^"']+)["']/g)) await add(set, (m[1] ?? m[2]).trim(), path);
    }
    if (/\.m?js$/.test(path)) {
      for (const m of item.content.toString().matchAll(/(?:import\s*(?:[^"'();]*?\sfrom\s*)?|export\s+[^"';]*?\sfrom\s*)["']([^"']+)["']/g)) await add(set, m[1], path);
    }
  };
  const pages = [];
  for (const document of documents) {
    const html = (await resource(document)).content.toString(); diagnostics.add(document);
    // Retain deferred/linked variants in diagnostics, never as initial downloads.
    for (const tag of html.match(/<(?:img|source|a|link|script|video|audio|iframe|object|embed)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) ?? []) {
      const a = attrs(tag);
      for (const url of [a.src, a.href, a.poster, a.data, ...split(a.srcset ?? a.imagesrcset ?? "").map(s => s.split(/\s+/)[0]), ...split(a["data-gallery-preview-srcset"] ?? "").map(s => s.split(/\s+/)[0])]) await add(new Set(), url, document, false);
    }
    const estimates = [], lazy = new Set();
    try {
      for (const scenario of scenarios) {
        const deferred = new Set();
        const initial = new Set(); await add(initial, "/" + document.replaceAll("\\", "/"), document);
        let picture;
        for (const tag of html.match(/<\/?(?:picture|source|img|link|script|style|video|audio|iframe|object|embed)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) ?? []) {
          const name = tag.match(/^<\/?(\w+)/)[1].toLowerCase(), a = attrs(tag);
          if (name === "picture") { picture = tag.startsWith("</") ? undefined : []; continue; }
          if (name === "source") { if (picture && mediaMatches(a.media, scenario.width)) picture.push(a); continue; }
          if (name === "img") {
            const selected = selectImage(picture?.[0] ?? a, scenario);
            await add(a.loading?.toLowerCase() === "lazy" ? deferred : initial, selected, document); continue;
          }
          if (name === "link" && mediaMatches(a.media, scenario.width)) {
            const rel = (a.rel ?? "").toLowerCase().split(/\s+/);
            if (rel.some(r => ["stylesheet", "preload", "modulepreload", "icon"].includes(r))) await add(initial, selectImage(a, scenario), document);
          }
          if (name === "script" && (!a.type || /^(?:module|text\/javascript|application\/javascript)$/i.test(a.type))) await add(initial, a.src, document);
          if (name === "video") { await add(initial, a.poster, document); if (a.preload && a.preload !== "none") await add(initial, a.src, document); }
          if (["iframe", "embed", "object", "audio"].includes(name) && a.loading !== "lazy" && a.preload !== "none") await add(initial, a.src ?? a.data, document);
        }
        // Inline CSS also carries load-bearing font/background references.
        for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) for (const u of m[1].matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) await add(initial, u[1].trim(), document);
        for (const path of deferred) lazy.add(path);
        estimates.push({ ...scenario, lazyGzip: [...deferred].reduce((sum, path) => sum + cache.get(path).gzip, 0), resources: [...initial], gzip: [...initial].reduce((sum, path) => sum + cache.get(path).gzip, 0) });
      }
      const worst = estimates.reduce((max, estimate) => estimate.gzip > max.gzip ? estimate : max);
      pages.push({ path: document.replaceAll("\\", "/"), gzip: worst.gzip, worst, estimates, lazyMaxGzip: Math.max(...estimates.map(e => e.lazyGzip)), lazyGzip: [...lazy].reduce((sum, path) => sum + cache.get(path).gzip, 0) });
    } catch (error) { errors.push(`${document}: ${error.message}`); }
  }
  const resources = [...diagnostics].map(path => cache.get(path)).filter(Boolean).map(({ content, ...item }) => item).sort((a, b) => b.gzip - a.gzip);
  const failures = [...errors, ...pages.filter(p => p.gzip > INITIAL_BUDGET).map(p => `${p.path}: compressed initial payload exceeds 200.0 KiB`)];
  const javascriptFiles = files.filter(file => extname(file) === ".js");
  // Retain the existing separate no-generated-bundles constraint.
  if (javascriptFiles.length) failures.push(`unexpected generated JavaScript: ${javascriptFiles.join(", ")}`);
  return { pages, resources, failures, javascriptFiles, siteGzip: resources.reduce((sum, item) => sum + item.gzip, 0), assetGzip: resources.filter(r => !r.path.endsWith(".html")).reduce((sum, item) => sum + item.gzip, 0) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await auditPerformance(resolve("dist"));
  const kib = bytes => `${(bytes / 1024).toFixed(1)} KiB`;
  console.log(`Production documents checked: ${result.pages.length}; per-document budget: ${kib(INITIAL_BUDGET)}`);
  console.log("Static cold-cache estimates; worst of 320/430/768/1366/1920px at DPR 1/2. Native lazy-load proximity is browser-dependent.");
  for (const page of result.pages) console.log(`${page.gzip <= INITIAL_BUDGET ? "PASS" : "FAIL"} ${page.path}: initial ${kib(page.gzip)} (${page.worst.width}px @${page.worst.dpr}x); lazy max scenario ${kib(page.lazyMaxGzip)}, candidate union ${kib(page.lazyGzip)}`);
  console.log(`Site-wide diagnostic only: ${result.resources.length} documents/referenced resources, ${kib(result.siteGzip)} gzip; assets excluding HTML ${kib(result.assetGzip)}`);
  console.log("Largest first-party resources (diagnostic only):");
  result.resources.slice(0, 10).forEach(r => console.log(`  ${r.path}: ${kib(r.raw)} raw / ${kib(r.gzip)} gzip`));
  console.log(`Generated JavaScript bundles: ${result.javascriptFiles.length}`);
  if (result.failures.length) { result.failures.forEach(f => console.error(`FAIL ${f}`)); process.exitCode = 1; }
  else console.log("Performance budget audit passed for every document.");
}
