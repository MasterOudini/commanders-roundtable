// Window bounds persistence.
//
// The interesting case is not saving — it is loading bounds that are no longer
// valid. A window remembered on a second monitor that is now unplugged, or a
// laptop docked at a different resolution, would otherwise restore off-screen
// and read as "the app launched but there is no window". So every restore is
// checked against the CURRENT display layout and falls back to centred-default.

const { screen } = require('electron');
const { files } = require('./paths.cjs');
const { readJson, writeJsonAtomic, coerce, is } = require('./jsonstore.cjs');

const SPEC = {
  x: { default: null, check: (v) => v === null || Number.isInteger(v) },
  y: { default: null, check: (v) => v === null || Number.isInteger(v) },
  width: { default: 1500, check: is.integer },
  height: { default: 950, check: is.integer },
  maximized: { default: true, check: is.boolean },
};

const MIN_W = 1100;
const MIN_H = 720;
/** How much of the window must land on a real display for the position to be reusable. */
const VISIBLE_MARGIN = 80;

/** Bounds that are safe to hand to BrowserWindow right now. */
function load() {
  const saved = coerce(SPEC, readJson(files.window(), {}));

  const width = Math.max(MIN_W, saved.width);
  const height = Math.max(MIN_H, saved.height);

  if (saved.x === null || saved.y === null) {
    return { width, height, maximized: saved.maximized };
  }

  // Is a meaningful chunk of the saved rect on some display we actually have?
  const onScreen = screen.getAllDisplays().some((display) => {
    const wa = display.workArea;
    return (
      saved.x + width > wa.x + VISIBLE_MARGIN &&
      saved.y + height > wa.y + VISIBLE_MARGIN &&
      saved.x < wa.x + wa.width - VISIBLE_MARGIN &&
      saved.y < wa.y + wa.height - VISIBLE_MARGIN
    );
  });

  return onScreen
    ? { x: saved.x, y: saved.y, width, height, maximized: saved.maximized }
    : { width, height, maximized: saved.maximized };
}

/**
 * Persist on move/resize/maximize, debounced, plus one final write on close
 * (the debounce would otherwise lose the last change on quit).
 */
function track(win) {
  let timer = null;

  const snapshot = () => {
    if (win.isDestroyed()) return;
    const maximized = win.isMaximized();
    // getNormalBounds is the un-maximized rect, which is what we want to
    // restore to when the user un-maximizes later.
    const b = win.getNormalBounds();
    writeJsonAtomic(files.window(), {
      x: Number.isInteger(b.x) ? b.x : null,
      y: Number.isInteger(b.y) ? b.y : null,
      width: b.width,
      height: b.height,
      maximized,
    });
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(snapshot, 400);
  };

  for (const event of ['resize', 'move', 'maximize', 'unmaximize']) {
    win.on(event, schedule);
  }
  win.on('close', () => {
    if (timer) clearTimeout(timer);
    snapshot();
  });
}

module.exports = { load, track };
