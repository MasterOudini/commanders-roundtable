/**
 * Screenshot the running dev renderer over CDP.
 *
 *   node scripts/screenshot.cjs out.png [--full] [--wait 800]
 *
 * Requires an Electron dev instance started with --remote-debugging-port=9223.
 * `--full` captures beyond the viewport (the fixture screens scroll).
 *
 * Exists because visual work needs visual proof: M2's animation beats are judged
 * by eye, and "trust me, it overshoots" is not a verification.
 */

const fs = require('fs');
const path = require('path');
const { findPageTarget } = require('./cdp.cjs');

async function main() {
  const args = process.argv.slice(2);
  const out = path.resolve(args.find((a) => !a.startsWith('--')) ?? 'screenshot.png');
  const full = args.includes('--full');
  const waitIdx = args.indexOf('--wait');
  const waitMs = waitIdx !== -1 ? Number(args[waitIdx + 1]) : 500;

  const page = await findPageTarget();
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('CDP socket error')), { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(msg.error.message));
    else entry.resolve(msg.result);
  });

  const send = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 20000);
    });

  // Let fonts, images and any entry animation settle — a screenshot taken during
  // a fade-in is not evidence of anything.
  await send('Runtime.evaluate', {
    expression: `(async () => { await document.fonts.ready; await new Promise(r => setTimeout(r, ${waitMs})); })()`,
    awaitPromise: true,
  });

  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: full,
  });

  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  socket.close();
  console.log(`${out}  (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(`Screenshot failed: ${e.message}`);
  process.exit(1);
});
