// Populates .electron-dist for electron-builder.
//
// ⚠️ This is the EPERM workaround, and it is NOT optional on this machine.
// electron-builder normally extracts the electron zip into a temp dir and then
// RENAMES it (win-unpacked.tmp → win-unpacked). That rename is permanently
// denied here — deletes succeed, the rename does not, and it does not go away on
// retry. Pointing build.electronDist at an already-extracted directory skips the
// extract+rename entirely.
//
// node_modules/electron/dist is exactly that already-extracted distribution, so
// this just copies it. Run automatically by `npm run electron:build`.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'node_modules', 'electron', 'dist');
const DEST = path.join(ROOT, '.electron-dist');

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[electron-dist] ${SRC} is missing. Run \`npm install\` first.`);
    process.exit(1);
  }

  const srcExe = path.join(SRC, 'electron.exe');
  const destExe = path.join(DEST, 'electron.exe');

  // Refresh only when stale: this copies ~250 MB, and doing it on every build
  // would add ~10 s for nothing.
  if (fs.existsSync(destExe)) {
    const a = fs.statSync(srcExe).mtimeMs;
    const b = fs.statSync(destExe).mtimeMs;
    if (b >= a) {
      console.log('[electron-dist] Already current.');
      return;
    }
    console.log('[electron-dist] Stale — refreshing.');
    fs.rmSync(DEST, { recursive: true, force: true });
  }

  console.log(`[electron-dist] Copying ${SRC} → ${DEST}`);
  fs.cpSync(SRC, DEST, { recursive: true });
  console.log('[electron-dist] Done.');
}

main();
