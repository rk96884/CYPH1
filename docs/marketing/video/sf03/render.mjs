import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const build = join(root, 'build');
const out = join(root, 'public/brand/social/cyph1-sf-03-ipl-does-not-read-phase.mp4');
const ffmpeg = process.env.FFMPEG || join(build, 'ffmpeg/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe');
const edge = process.env.CHROMIUM || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const playwrightPath = process.env.PLAYWRIGHT_MODULE || 'C:\\Users\\rishi\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright';
const require = createRequire(import.meta.url);
const { chromium } = require(playwrightPath);
const fps = 30;
const duration = 23.5;
const frames = Math.round(fps * duration);
mkdirSync(build, { recursive: true });
if (!existsSync(ffmpeg)) throw new Error(`FFmpeg not found: ${ffmpeg}`);

function run(args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolveRun() : reject(new Error(`FFmpeg exited ${code}`)));
  });
}

const browser = await chromium.launch({ executablePath: edge, headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(here, 'storyboard.html')).href);
await page.evaluate(() => document.fonts.ready);
const visual = join(build, 'sf03-video-only.mp4');
const encoder = spawn(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', visual], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let i = 0; i < frames; i++) {
  await page.evaluate(t => window.renderAt(t), i / fps);
  const png = await page.screenshot({ type: 'png' });
  if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
  if (i % 90 === 0) console.log(`Rendered ${i}/${frames} frames`);
}
encoder.stdin.end();
const [code] = await once(encoder, 'close');
await browser.close();
if (code !== 0) throw new Error(`Video encoder exited ${code}`);

const voice = ['01-hook.mp3', '02-asynchronous.mp3', '03-repeat.mp3', '04-routine.mp3', '05-lockup.mp3'].map(name => join(here, 'voice', name));
const delays = [0, 4200, 10100, 14100, 19100];
const filters = voice.map((_, i) => `[${i + 2}:a]adelay=${delays[i]}|${delays[i]},volume=1.35[v${i}]`);
filters.push(`[1:a]volume=0.22[music]`);
filters.push(`[music]${voice.map((_, i) => `[v${i}]`).join('')}amix=inputs=6:duration=first:normalize=0,alimiter=limit=0.92[a]`);
await run(['-y', '-hide_banner', '-loglevel', 'error', '-i', visual, '-i', join(here, 'music-and-sfx.wav'), ...voice.flatMap(f => ['-i', f]), '-filter_complex', filters.join(';'), '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-t', String(duration), '-movflags', '+faststart', out]);
console.log(out);
