import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  site: "https://www.cyph1.co.uk",
  base,
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [sitemap({ filter: (page) => !page.includes("/early-access/confirmed/") && !page.includes("/privacy/") })],
});
