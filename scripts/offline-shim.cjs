// Pull the network cable, for one process only.
//
// ⚠️ Loaded with `NODE_OPTIONS=--require`, so it is NEVER part of the app. The
// offline audit needs the app's outbound calls to genuinely fail, and the honest
// ways to arrange that on a real machine are all bad: disconnecting the user's
// adapter, editing the hosts file (needs administrator rights), or adding a
// test-only kill switch to production code — which would then be a kill switch
// that ships.
//
// So the failure is injected at the Node layer, in the spawned process only, and
// it is the SAME failure a pulled cable produces: DNS does not resolve.
// `getaddrinfo ENOTFOUND` is exactly what `electron/scryfall.cjs` would see with
// no network, so nothing here is a nicer or a nastier error than the real one.
//
// ⚠️ It deliberately does NOT block loopback or private addresses. A LAN game is
// supposed to keep working with no internet — that is half of what the audit is
// proving — and blocking 127.0.0.1 would make the LAN listener fail for reasons
// that have nothing to do with being offline.

const dns = require('node:dns');
const net = require('node:net');

/**
 * ⚠️ ONLY NAMES ARE BLOCKED. NEVER IP LITERALS.
 *
 * The first version blocked anything that was not loopback or RFC 1918, which
 * included `0.0.0.0` — the address `electron/lanServer.cjs` binds to. An
 * unhandled DNS error in the main process is an UNCAUGHT EXCEPTION, which in
 * Electron means the modal "A JavaScript error occurred in the main process" and
 * a dead app (trap 41, D59). The audit killed the thing it was auditing.
 *
 * It was also simply wrong about what being offline means. A machine with no
 * internet still resolves an IP literal perfectly well — there is no DNS to do.
 * What fails with no network is looking up a NAME. So: any literal address is
 * passed straight through, and only hostnames go dark.
 */
function isLiteralAddress(hostname) {
  const h = String(hostname).replace(/^\[|\]$/g, '');
  return net.isIP(h) !== 0;
}

const PRIVATE_NAME = /^(localhost|.*\.local|.*\.localhost)$/i;

function offlineError(hostname) {
  const err = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
  err.code = 'ENOTFOUND';
  err.errno = -3008;
  err.syscall = 'getaddrinfo';
  err.hostname = hostname;
  return err;
}

const realLookup = dns.lookup;
dns.lookup = function lookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  if (isLiteralAddress(hostname) || PRIVATE_NAME.test(String(hostname))) {
    return realLookup.apply(this, arguments);
  }
  if (typeof cb === 'function') {
    process.nextTick(() => cb(offlineError(hostname)));
    return undefined;
  }
  throw offlineError(hostname);
};

if (dns.promises && typeof dns.promises.lookup === 'function') {
  const realPromiseLookup = dns.promises.lookup;
  dns.promises.lookup = async function lookup(hostname, options) {
    if (isLiteralAddress(hostname) || PRIVATE_NAME.test(String(hostname))) {
      return realPromiseLookup.call(this, hostname, options);
    }
    throw offlineError(hostname);
  };
}

// eslint-disable-next-line no-console
console.log('[offline-shim] hostname lookups are dark; IP literals and localhost still resolve');
