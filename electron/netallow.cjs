// Which WebSocket origins the renderer is allowed to reach.
//
// ⚠️ THE ONE DELIBERATE WIDENING OF `connect-src` (D4 flagged it, D48 records
// it). Every other outbound call this app makes happens in the MAIN process
// behind an exact-host allowlist; the multiplayer transport is the exception,
// because a WebSocket that had to be proxied through IPC would double every
// frame's cost and put the game's hot path behind two serialisation hops.
//
// ⚠️ SO THE WIDENING IS PER ORIGIN, NOT PER SCHEME. `connect-src 'self' wss:`
// would let a compromised renderer post anywhere on the internet; what ships is
// `connect-src 'self' <the relay the user configured> <the LAN host they typed>`
// and nothing else. The list lives in settings, so it survives a restart and is
// inspectable in a text editor.
//
// ⚠️ A PLAINTEXT `ws://` ORIGIN IS ACCEPTED ONLY ON A PRIVATE ADDRESS. Direct-IP
// play on a home network is the whole point of the LAN transport, and demanding
// a certificate for `ws://192.168.1.42:5282` would make it unusable. An
// unencrypted socket to a PUBLIC address is refused: that is somebody's game
// traffic crossing the internet in the clear, and the fix is `wss://`.

const settings = require('./settings.cjs');

const LAN_PORT = 5282;
const MAX_ORIGINS = 8;

/** Loopback and the three RFC 1918 private ranges. Nothing else counts as LAN. */
function isPrivateHost(host) {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]') return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if ([a, Number(m[3]), Number(m[4])].some((n) => !Number.isInteger(n) || n > 255)) return false;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 169.254.x.x — link-local, which is what a direct cable connection gets.
  if (a === 169 && b === 254) return true;
  return false;
}

/**
 * Validate a URL the user typed and reduce it to a CSP origin.
 *
 * Returns `{ ok, origin, message }`. The message is written from the user's
 * side and says what to do, because this is a dialog they will actually read.
 */
function checkUrl(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (text === '') return { ok: false, origin: '', message: 'Enter an address first.' };
  let url;
  try {
    url = new URL(text);
  } catch {
    return {
      ok: false,
      origin: '',
      message: `"${text}" is not an address. It should look like wss://relay.example.com or ws://192.168.1.42:${LAN_PORT}.`,
    };
  }
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    return {
      ok: false,
      origin: '',
      message: `A game address must start with wss:// or ws://, not ${url.protocol}//.`,
    };
  }
  if (url.protocol === 'ws:' && !isPrivateHost(url.hostname)) {
    return {
      ok: false,
      origin: '',
      message:
        `ws:// is unencrypted, so it is only allowed on your own network. Use wss://${url.host} for a relay on the internet.`,
    };
  }
  // `URL.origin` is "null" for a ws: URL in some Node versions, so build it.
  const origin = `${url.protocol}//${url.host}`;
  return { ok: true, origin, message: '' };
}

function allowed() {
  const raw = settings.get().allowedOrigins;
  return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string' && x !== '') : [];
}

/**
 * Add an origin. Returns `{ ok, origin, added, message }`.
 *
 * ⚠️ `added: true` means the CSP for the CURRENT document does not include it —
 * the header is set when the document loads, so the caller has to reload before
 * the socket will open. That is the honest cost of a per-origin allowlist, and
 * it happens once per new address rather than once per game.
 */
function allow(raw) {
  const check = checkUrl(raw);
  if (!check.ok) return { ...check, added: false };
  const list = allowed();
  if (list.includes(check.origin)) return { ...check, added: false };
  // Oldest first out, so a user who cycles through relays does not have to
  // clear anything by hand.
  const next = [...list, check.origin].slice(-MAX_ORIGINS);
  settings.set({ allowedOrigins: next });
  return { ...check, added: true };
}

/** Every origin the renderer may open a socket to, for the CSP header. */
function connectSources() {
  // ⚠️ Hosting a LAN game means connecting to OUR OWN listener, which is always
  // loopback from this app's point of view — the LAN bind is for the guests.
  const own = [`ws://127.0.0.1:${LAN_PORT}`, `ws://localhost:${LAN_PORT}`];
  const configured = [];
  const relay = settings.get().relayUrl;
  if (typeof relay === 'string' && relay.trim() !== '') {
    const check = checkUrl(relay);
    if (check.ok) configured.push(check.origin);
  }
  return [...new Set([...own, ...configured, ...allowed()])];
}

module.exports = { checkUrl, allow, allowed, connectSources, isPrivateHost, LAN_PORT };
