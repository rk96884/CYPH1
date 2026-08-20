import { defineConfig } from "astro/config";
const base = process.env.BASE_PATH || "/";

export default defineConfig({ site: "https://www.cyph1.co.uk", base, trailingSlash: "always", build: { format: "directory" } });

