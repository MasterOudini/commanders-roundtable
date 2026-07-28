// Auto-update via GitHub Releases (workspace policy: mandatory, and the one
// approved network call at startup).
//
// ⚠️ Refuses to check an UNCONFIGURED feed. package.json still ships
// publish.owner = "OWNER", and github.com/OWNER is a registrable namespace —
// pointing auto-update at it would let whoever claims that account ship an
// update to every install. So we read the packaged app-update.yml and only
// check when the owner has been set to something real.

const fs = require('fs');
const path = require('path');

let state = { state: 'idle', version: null, message: null };
let notify = () => {};

function feedOwner() {
  try {
    const yml = fs.readFileSync(path.join(process.resourcesPath, 'app-update.yml'), 'utf8');
    const m = yml.match(/^\s*owner:\s*(.+?)\s*$/m);
    return m ? m[1].replace(/^['"]|['"]$/g, '').trim() : '';
  } catch {
    return ''; // no app-update.yml — feed not configured
  }
}

function setState(next) {
  state = { ...state, ...next };
  try { notify(state); } catch { /* window gone */ }
}

function getStatus() {
  return { ...state };
}

function start({ app, onStatus }) {
  if (typeof onStatus === 'function') notify = onStatus;

  if (!app.isPackaged) {
    setState({ state: 'disabled', message: 'Auto-update is off in development builds.' });
    return;
  }

  const owner = feedOwner();
  if (!owner || owner === 'OWNER') {
    setState({
      state: 'skipped',
      message: 'Update feed is not configured yet, so this build will not check for updates.',
    });
    console.warn('[updater] Skipped: publish.owner is unset/placeholder. Set it to a real GitHub account before distributing.');
    return;
  }

  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    setState({ state: 'unavailable', message: 'The updater component is missing from this build.' });
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => setState({ state: 'checking', message: null }));
  autoUpdater.on('update-not-available', () => setState({ state: 'current', message: null }));
  autoUpdater.on('update-available', (info) =>
    setState({ state: 'downloading', version: info?.version ?? null, message: null }));
  autoUpdater.on('download-progress', (p) =>
    setState({ state: 'downloading', message: `${Math.round(p?.percent ?? 0)}%` }));
  autoUpdater.on('update-downloaded', (info) =>
    setState({
      state: 'ready',
      version: info?.version ?? null,
      message: 'Update ready — it will install when you close the app.',
    }));
  autoUpdater.on('error', (err) =>
    setState({ state: 'error', message: err?.message ?? 'Update check failed.' }));

  autoUpdater.checkForUpdatesAndNotify().catch(() => { /* handled by the error event */ });
}

module.exports = { start, getStatus };
