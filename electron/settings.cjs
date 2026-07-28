// User settings. One flat, schema-validated object in <dataRoot>/settings.json.
//
// Every key must be declared in SPEC. Unknown keys are dropped on read AND on
// write, so a renderer that has been compromised (or a stale build) cannot
// smuggle arbitrary data into a file the main process later trusts.

const { files } = require('./paths.cjs');
const { readJson, writeJsonAtomic, coerce, is } = require('./jsonstore.cjs');

const SPEC = {
  // Shown to the other players in the lobby. Defaulted at first launch from
  // the OS username by main.cjs, not here (paths.cjs stays side-effect free).
  playerName: { default: '', check: is.string },

  // Multiplayer. Empty by default: the app is fully playable over LAN /
  // direct IP before any relay exists, so shipping an empty relay URL is the
  // honest default rather than pointing at a server the user does not own.
  relayUrl: { default: '', check: is.string },

  // ⚠️ The renderer's `connect-src` allowlist, and the ONLY thing that widens
  // it. Each entry is a validated `ws://`/`wss://` ORIGIN (see netallow.cjs),
  // never a scheme wildcard: `connect-src 'self' wss:` would let a compromised
  // renderer post anywhere on the internet. Persisted so the CSP survives a
  // restart, and inspectable in a text editor.
  allowedOrigins: { default: [], check: is.stringArray },

  // Animation feel. 'off' routes the choreographer to digest mode, the same
  // path prefers-reduced-motion takes.
  animationSpeed: { default: 'cinematic', check: is.oneOf('cinematic', 'brisk', 'fast', 'off') },

  // Casting: auto-tap suggests a payment and you confirm (Arena's model).
  // Off means you tap every source by hand.
  autoTapMana: { default: true, check: is.boolean },

  // Download a deck's card art in the background when it is imported, so a
  // game never waits on the network.
  prefetchArtOnImport: { default: true, check: is.boolean },

  // Fidelity tier for cached art. 'png' is Scryfall's maximum (745×1040 with
  // transparent corners, ~0.9 MB/card). Per the standing never-reduce-quality
  // rule this is the default; 'large' (672×936 JPG, ~150 KB) exists only for
  // someone who is genuinely short on disk.
  imageTier: { default: 'png', check: is.oneOf('png', 'large') },
};

let cache = null;

function get() {
  if (!cache) cache = coerce(SPEC, readJson(files.settings(), {}));
  return { ...cache };
}

/** Merge a patch in, dropping anything not in SPEC. Returns the new settings. */
function set(patch) {
  const merged = coerce(SPEC, { ...get(), ...(patch && typeof patch === 'object' ? patch : {}) });
  cache = merged;
  writeJsonAtomic(files.settings(), merged);
  return { ...merged };
}

function defaults() {
  return coerce(SPEC, {});
}

module.exports = { get, set, defaults, SPEC };
