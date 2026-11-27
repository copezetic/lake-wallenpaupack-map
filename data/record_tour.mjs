import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const [,, url, out, secsArg, mode] = process.argv;
const FPS = 30, DT = 1000 / FPS, W = 1920, H = 1080;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('pageerror', e.message));
await page.addInitScript(() => {
  let v = 1000, id = 1e9; const raf = new Map(), tos = new Map();
  performance.now = () => v;
  window.requestAnimationFrame = f => { raf.set(++id, f); return id; };
  window.cancelAnimationFrame = i => raf.delete(i);
  const rST = window.setTimeout, rCT = window.clearTimeout;
  window.setTimeout = (f, ms = 0, ...a) => { tos.set(++id, { at: v + (+ms || 0), f, a }); return id; };
  window.clearTimeout = i => { if (!tos.delete(i)) rCT(i); };
  window.__step = dt => {
    v += dt;
    for (const [i, t] of [...tos].sort((a, b) => a[1].at - b[1].at)) if (t.at <= v && tos.delete(i)) { try { typeof t.f === 'function' && t.f(...t.a); } catch (e) { console.error(e); } }
    const cbs = [...raf.values()]; raf.clear();
    for (const f of cbs) { try { f(v); } catch (e) { console.error(e); } }
    for (const a of document.getAnimations()) { try { if (a.playState === 'running') a.pause(); a.currentTime = (+a.currentTime || 0) + dt;
      const end = a.effect && a.effect.getComputedTiming().endTime; if (end != null && a.currentTime >= end) a.finish(); } catch (e) {} }
    const c = document.getElementById('tourCap'); return !!(c && c.classList.contains('on'));
  };
});
await page.goto(url, { waitUntil: 'load' });
let on = false, n = 0;
while (!on && n < 1500) { on = await page.evaluate(d => window.__step(d), DT); await page.waitForTimeout(60); n++; }
console.log('caption on after warm-up frames:', n, on);
await page.waitForTimeout(8000);                         // real time for textures and weather to arrive
if (mode === 'test') {
  for (const t of [0, 4, 9]) { for (let i = 0; i < (t ? 150 : 1); i++) await page.evaluate(d => window.__step(d), DT); await page.waitForTimeout(1500); await page.evaluate(() => window.__step(0)); await page.screenshot({ path: `${out}-${t}.png` }); }
  console.log(await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl'); const e = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(e.UNMASKED_RENDERER_WEBGL); }));
} else {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-vf', `fade=t=in:st=0:d=0.6,fade=t=out:st=${+secsArg - 1}:d=1`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < 32; i++) await page.evaluate(d => window.__step(d), DT);   // let the loader fade and the first caption arrive
  const N = Math.round(+secsArg * FPS), t0 = Date.now();
  for (let i = 0; i < N; i++) {
    if (i) await page.evaluate(d => window.__step(d), DT);
    const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log('frame', i, '/', N, Math.round((Date.now() - t0) / 1000) + 's');
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await browser.close();
