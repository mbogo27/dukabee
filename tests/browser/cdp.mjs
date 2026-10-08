// Tiny Chrome DevTools Protocol driver for browser smoke tests: no dependencies (Node 22's global WebSocket).
// Launches headless Chrome/Edge, emulates a device width, navigates, evaluates JS and takes screenshots.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
export const findChrome = () => CANDIDATES.find((p) => fs.existsSync(p)) || null;

export async function launch({ port = 9300 + Math.floor(Math.random() * 500) } = {}) {
  const bin = findChrome();
  if (!bin) throw new Error('No Chrome/Edge found (set CHROME_PATH)');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-cdp-'));
  const proc = spawn(bin, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
  }
  if (!target) { proc.kill(); throw new Error('Chrome did not start'); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map(), listeners = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
    else listeners.forEach((l) => l(msg));
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  const errors = [];
  listeners.push((m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text);
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  const waitLoad = () => new Promise((r) => { const l = (m) => { if (m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); });

  const page = {
    errors,
    send,
    async viewport(width, height = 800, mobile = width < 600) { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }); },
    async goto(url) { const loaded = waitLoad(); await send('Page.navigate', { url }); await loaded; await page.waitFor(`document.readyState === 'complete' && location.href === ${JSON.stringify(new URL(url).href)}`); await page.settle(); },
    /** Poll a page expression until it's truthy (navigation, async rendering), instead of sleeping a fixed time. */
    async waitFor(expr, timeout = 30000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        try { if (await page.eval(expr)) return; } catch { /* page mid-navigation */ }
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`Timed out waiting for: ${expr}`);
    },
    async settle(ms = 250) { await new Promise((r) => setTimeout(r, ms)); },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async back() { const loaded = new Promise((r) => setTimeout(r, 400)); await send('Runtime.evaluate', { expression: 'history.back()' }); await loaded; },
    async screenshot(file, { fullPage = true } = {}) {
      let clip;
      if (fullPage) { const { cssContentSize } = await send('Page.getLayoutMetrics'); clip = { x: 0, y: 0, width: cssContentSize.width, height: Math.min(cssContentSize.height, 6000), scale: 1 }; }
      const { data } = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) });
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
    },
    async close() { try { ws.close(); } catch { /* closed */ } proc.kill(); await new Promise((r) => setTimeout(r, 300)); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* still locked on Windows */ } },
  };
  return page;
}
