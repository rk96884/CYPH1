import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const output = join(root, 'public/brand/social/ca-01-meet-the-four-phases');
mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:\\Users\\rishi\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
for (let n = 1; n <= 6; n++) {
  await page.goto(`${pathToFileURL(join(here, 'slides.html')).href}?slide=${n}`);
  await page.evaluate(() => document.fonts.ready);
  const name = `cyph1-ca-01-${String(n).padStart(2, '0')}.png`;
  await page.screenshot({ path: join(output, name), type: 'png' });
  console.log(name);
}
await browser.close();
