// Importing a decklist from a link: TappedOut, Moxfield, Archidekt.
//
// The SECOND network module in the app, and deliberately separate from
// scryfall.cjs rather than a widening of its allowlist: card data and card art
// must never be fetchable from a deck site, and a deck site must never be
// fetchable from the image queue. Two allowlists, each exact, each owning its
// own call sites.
//
// Runs in the MAIN process only. The renderer has `connect-src 'self'` and no
// network reach at all — it hands over a URL STRING and gets decklist TEXT back,
// which then goes through exactly the same parser a pasted list does. Importing
// from a link adds a download, not a second import path (D92).
//
// ⚠️ EVERY site adapter produces TEXT in the same Arena shape:
//
//     Commander
//     1x Verrak, Warped Sengir (DMC) 16
//
//     Deck
//     1x Angel of the Ruins (EOC) 63
//
// That is the whole design. `src/data/decklist.ts` already read this format
// before any of this existed, so a new site is a function that returns a string
// — never a second path into a DeckFile, and never a second idea of what a
// commander is.
//
// Hardening, the same posture as scryfall.cjs:
//   • exact-host allowlists, https only, no credentials, no non-default port
//   • the PATH is validated too, and the request URL is BUILT from the deck id
//     we read — a link can only ever name a deck, never an arbitrary page
//   • a link host is not automatically a fetch host: pasting moxfield.com is
//     allowed, and the GET goes to api2.moxfield.com because we say so
//   • redirects re-validated against the allowlist
//   • per-request byte cap and idle timeout
//   • rate limit, and a descriptive User-Agent that names this app
//
// ─── Endpoint facts, measured 2026-07-27 (do not re-derive by guessing) ───
//
// TAPPEDOUT. `?fmt=txt` (and `?fmt=dek`, byte-identical) give a clean
// `1 Card Name` list — and NEITHER marks the commander, which for a Commander
// deck is the one thing the list has to say. `?fmt=multiverse` returned 90 empty
// names, `?fmt=markdown` a title with no cards, `?fmt=cod` / `?fmt=doc` are not
// implemented and serve the deck page. So we fetch the deck page (160–660 KB)
// and lift the Arena export out of `<textarea id="mtga-textarea">`, which was
// present on every deck measured. `?fmt=txt` stays as the fallback for the day
// that template changes.
//
// MOXFIELD. `https://api2.moxfield.com/v3/decks/all/<publicId>` → 460 KB–1.4 MB
// of JSON with `name` and a `boards` object; `boards.commanders` is explicit and
// was populated on 6 of 6 commander decks measured, including two partner pairs.
// `/download?format=txt` is not a thing (400: "The value 'txt' is not valid").
// ⚠️ Moxfield's API is undocumented and unversioned by contract. It answered a
// request identifying this app, and it may stop doing so at any time — which is
// why the failure path says "paste the list instead" rather than pretending.
// We do not impersonate a browser to get around that.
//
// ARCHIDEKT. `https://archidekt.com/api/decks/<id>/` → ~190–360 KB of JSON with
// `name`, `cards[]` and `categories[]`. Two rules, both measured on 6 of 6 decks:
//   • a card in a category whose `includedInDeck` is false is NOT in the deck
//     (that is where the Maybeboard lives). Excluding them gave exactly 100.
//   • the commander is the card in the category named "Commander" — except when
//     the user has RENAMED it, which one of the six had ("Turn 2 ramp"). The
//     renamed one still carried `isPremier`, so that is the fallback.
//
// ⚠️ Deck sites' set codes are their own and not always Scryfall's — TappedOut
// emits `(000)` and `(GRV)`. That is harmless: cardindex.byName falls through to
// name resolution when a set + collector number matches nothing, so the card
// resolves to its best printing rather than failing.

const https = require('https');

// ⚠️ Keep the version in step with package.json — a deck site being told which
// build is calling is the whole point of identifying ourselves at all.
const USER_AGENT = 'CommandersRoundtable/0.1.1 (private Commander game client)';

/**
 * Hosts we actually GET from. Exact, not suffixes: 'tappedout.net.attacker.net'
 * must not pass. A LINK host is a separate question — see SITES.
 */
const ALLOWED_HOSTS = new Set([
  'tappedout.net', // the deck page
  'api2.moxfield.com', // Moxfield's deck API
  'archidekt.com', // Archidekt's deck API
]);

const LIMITS = {
  /** A deck page measured 160–660 KB; Moxfield's JSON up to 1.4 MB. */
  responseMaxBytes: 8 * 1024 * 1024,
  /** The decklist we hand back. A 100-card list is ~3 KB. */
  textMaxBytes: 512 * 1024,
  /** No data at all for this long → give up. */
  idleTimeoutMs: 20_000,
  /** We make at most two requests per import; this is plain courtesy. */
  minRequestSpacingMs: 500,
  maxRedirects: 3,
};

class DeckFetchError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DeckFetchError';
    this.code = code;
  }
}

// ── the sites ────────────────────────────────────────────────────
//
// One entry per site: which links belong to it, how to read a deck id out of
// one, what to call the deck's page, and how to turn that id into decklist text.

const SITES = {
  tappedout: {
    label: 'TappedOut',
    linkHosts: ['tappedout.net', 'www.tappedout.net'],
    example: 'https://tappedout.net/mtg-decks/your-deck-name/',
    /** `/mtg-decks/<slug>/` — anything after the slug is a subpage of the deck. */
    idFrom: (parts) => (parts[0] === 'mtg-decks' ? decodeURIComponent(parts[1] ?? '') : ''),
    idShape: /^[A-Za-z0-9][A-Za-z0-9_-]{0,120}$/,
    pageUrl: (id) => `https://tappedout.net/mtg-decks/${id}/`,
    load: loadTappedOut,
  },
  moxfield: {
    label: 'Moxfield',
    linkHosts: ['moxfield.com', 'www.moxfield.com'],
    example: 'https://www.moxfield.com/decks/your-deck-id',
    idFrom: (parts) => (parts[0] === 'decks' ? decodeURIComponent(parts[1] ?? '') : ''),
    idShape: /^[A-Za-z0-9_-]{3,64}$/,
    pageUrl: (id) => `https://www.moxfield.com/decks/${id}`,
    load: loadMoxfield,
  },
  archidekt: {
    label: 'Archidekt',
    linkHosts: ['archidekt.com', 'www.archidekt.com'],
    example: 'https://archidekt.com/decks/1234567/your-deck-name',
    idFrom: (parts) => (parts[0] === 'decks' ? decodeURIComponent(parts[1] ?? '') : ''),
    idShape: /^\d{1,12}$/,
    pageUrl: (id) => `https://archidekt.com/decks/${id}`,
    load: loadArchidekt,
  },
};

/** hostname → site id. Exact hosts only. */
const LINK_HOSTS = new Map(
  Object.entries(SITES).flatMap(([id, site]) => site.linkHosts.map((h) => [h, id])),
);

/** "TappedOut, Moxfield or Archidekt" — for a message that has to list them. */
function siteList(join = 'or') {
  const labels = Object.values(SITES).map((s) => s.label);
  return `${labels.slice(0, -1).join(', ')} ${join} ${labels[labels.length - 1]}`;
}

// ── the network ──────────────────────────────────────────────────

let lastRequestAt = 0;
/** Chained, not computed per caller — see the note in scryfall.cjs's rateLimit. */
let rateGate = Promise.resolve();
function rateLimit() {
  const slot = rateGate.then(async () => {
    const wait = LIMITS.minRequestSpacingMs - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  rateGate = slot.catch(() => {});
  return slot;
}

/**
 * Validate a URL against the allowlist. Throws rather than returning null so a
 * missing check at a call site is a crash, not a silent bypass.
 */
function assertAllowedUrl(raw) {
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    throw new DeckFetchError(`Not a valid URL: ${raw}`, 'badUrl');
  }
  if (url.protocol !== 'https:') {
    throw new DeckFetchError(`Refusing non-https URL: ${url.protocol}`, 'notHttps');
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new DeckFetchError(`Host not in allowlist: ${url.hostname}`, 'hostNotAllowed');
  }
  if (url.username || url.password) {
    throw new DeckFetchError('Refusing URL with embedded credentials', 'hasCredentials');
  }
  if (url.port && url.port !== '443') {
    throw new DeckFetchError(`Refusing non-default port: ${url.port}`, 'badPort');
  }
  return url;
}

/**
 * A link the user pasted → the deck it names.
 *
 * ⚠️ Nothing here is ever fetched. The deck id is read out and every request URL
 * is BUILT from it, so a query string, a fragment, `/primer`, a port or embedded
 * credentials cannot reach the network. That is what makes the channel "name a
 * deck" rather than "name a URL". `http://` and a bare `moxfield.com/…` are
 * upgraded to https rather than refused — a pasted link should just work.
 */
function parseDeckUrl(raw) {
  const trimmed = String(raw ?? '').trim();
  if (trimmed.length === 0) {
    throw new DeckFetchError('Paste a deck link first.', 'empty');
  }

  // Accept what a browser's address bar actually yields, and what people paste
  // out of chat: with a scheme, without one, http or https.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new DeckFetchError(
      `That is not a web address: “${trimmed}”. Copy the deck's link from your browser's address bar.`,
      'badUrl',
    );
  }
  if (url.protocol === 'http:') url.protocol = 'https:';

  const siteId = LINK_HOSTS.get(url.hostname);
  if (!siteId) {
    throw new DeckFetchError(
      `This app imports decks from ${siteList()}, and that link points at ${url.hostname}. `
      + 'Paste a link from one of those, or paste the decklist text instead.',
      'hostNotAllowed',
    );
  }
  const site = SITES[siteId];

  // ⚠️ Building from the id already drops both of these, so refusing is not what
  // keeps the fetch safe — saying so is. A deck link out of an address bar never
  // carries a password or a port, so one that does is not the link the user
  // meant to paste, and quietly fetching something else is the worse answer.
  if (url.username || url.password) {
    throw new DeckFetchError(
      'That link carries a username and password. Copy the deck\'s plain address out of your '
      + "browser's address bar instead.",
      'hasCredentials',
    );
  }
  if (url.port && url.port !== '443') {
    throw new DeckFetchError(
      `That link points at port ${url.port}. A deck link has no port in it — copy the address `
      + "out of your browser's address bar.",
      'badPort',
    );
  }

  const parts = url.pathname.split('/').filter((s) => s.length > 0);
  const id = site.idFrom(parts);
  if (!site.idShape.test(id)) {
    throw new DeckFetchError(
      `That ${site.label} link does not point at a deck. A deck link looks like ${site.example} `
      + '— open the deck and copy the address.',
      'notADeckUrl',
    );
  }

  return { site: siteId, label: site.label, id, url: site.pageUrl(id) };
}

/**
 * One HTTPS GET with the allowlist, headers, redirect handling and idle timeout
 * applied. Resolves with the live response stream — the caller consumes it.
 */
function request(rawUrl, { headers = {}, redirectsLeft = LIMITS.maxRedirects } = {}) {
  const url = assertAllowedUrl(rawUrl);

  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...headers } },
      (res) => {
        const status = res.statusCode ?? 0;

        // A redirect must be re-validated against the allowlist — a redirect to
        // an arbitrary host is exactly what an allowlist exists to stop.
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            return reject(new DeckFetchError('Too many redirects', 'tooManyRedirects'));
          }
          const next = new URL(res.headers.location, url).toString();
          return request(next, { headers, redirectsLeft: redirectsLeft - 1 }).then(resolve, reject);
        }

        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new DeckFetchError(`HTTP ${status} for ${url.pathname}`, `http${status}`));
        }

        resolve(res);
      },
    );

    req.setTimeout(LIMITS.idleTimeoutMs, () => {
      req.destroy(new DeckFetchError('No data for 20s', 'idleTimeout'));
    });
    req.on('error', reject);
  });
}

/** GET a text document, with a hard byte cap. */
async function fetchText(rawUrl, { accept = 'text/html,text/plain;q=0.9,*/*;q=0.8' } = {}) {
  await rateLimit();
  const res = await request(rawUrl, { headers: { Accept: accept } });

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    res.on('data', (c) => {
      size += c.length;
      if (size > LIMITS.responseMaxBytes) {
        res.destroy();
        reject(new DeckFetchError('That answer is far larger than a decklist', 'tooLarge'));
        return;
      }
      chunks.push(c);
    });
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    res.on('error', reject);
  });
}

/** GET a JSON document. */
async function fetchJson(rawUrl) {
  const body = await fetchText(rawUrl, { accept: 'application/json;q=0.9,*/*;q=0.8' });
  try {
    return JSON.parse(body);
  } catch {
    throw new DeckFetchError('That deck came back as something other than a deck.', 'badJson');
  }
}

// ── shared text building ─────────────────────────────────────────

/**
 * One decklist line. The set and collector number are only written when BOTH
 * are known — a set code on its own would be peeled off as a category by the
 * parser's trailing-group pass, which is a subtly wrong printing rather than a
 * missing one.
 */
function entryLine(entry) {
  const printing = entry.set && entry.collectorNumber
    ? ` (${String(entry.set).toUpperCase()}) ${entry.collectorNumber}`
    : '';
  return `${entry.quantity}x ${entry.name}${printing}`;
}

/** Entries → the Arena-shaped text every adapter returns. Sorted, so a re-import diffs cleanly. */
function decklistText({ commanders = [], main = [], sideboard = [] }) {
  const block = (heading, entries) => (entries.length === 0 ? null : [
    heading,
    ...[...entries]
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))
      .map(entryLine),
  ].join('\n'));

  return [block('Commander', commanders), block('Deck', main), block('Sideboard', sideboard)]
    .filter((b) => b !== null)
    .join('\n\n');
}

/**
 * A card with no name cannot be written as a line at all. Both APIs carried one
 * on every entry of every deck measured; this is a guard, not a known case.
 */
function named(entries) {
  return entries.filter((e) => typeof e.name === 'string' && e.name.trim().length > 0);
}

// ── TappedOut ────────────────────────────────────────────────────

/**
 * The five entities Django escapes, plus numeric ones.
 *
 * ⚠️ ONE pass, not five replaces: decoding `&amp;` separately turns the escaped
 * text `&amp;lt;` into `<`, which is how an escaped card name becomes markup.
 */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
function decodeEntities(text) {
  return String(text).replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body) => {
    const key = body.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(NAMED, key)) return NAMED[key];
    if (key.startsWith('#x')) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (key.startsWith('#')) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return whole;
  });
}

/** The contents of one `<textarea id="...">`, decoded. Null when absent. */
function extractTextarea(html, id) {
  const re = new RegExp(`<textarea[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)</textarea>`, 'i');
  const m = re.exec(String(html));
  if (!m) return null;
  return decodeEntities(m[1] ?? '').replace(/\r\n?/g, '\n');
}

/** The section words an Arena export can open with. */
const ARENA_SECTION = /^(commander|deck|sideboard|companion|maybeboard)\s*$/i;

/**
 * Split an Arena export into its `About` header and the decklist proper.
 *
 * The header is dropped rather than parsed as cards — `About` and
 * `Name <deck name>` are perfectly good card lines as far as a decklist parser
 * is concerned, and would import as two cards that resolve to nothing. The name
 * is worth keeping: it is what the user called the deck.
 */
function splitArenaExport(raw) {
  const lines = String(raw ?? '').split('\n');
  const firstSection = lines.findIndex((l) => ARENA_SECTION.test(l.trim()));
  if (firstSection < 0) return { name: '', text: String(raw ?? '').trim() };

  let name = '';
  for (const line of lines.slice(0, firstSection)) {
    const m = /^Name\s+(.+)$/.exec(line.trim());
    if (m) name = (m[1] ?? '').trim();
  }
  return { name, text: lines.slice(firstSection).join('\n').trim() };
}

/** Does this text hold anything a decklist parser could read as a card? */
function looksLikeADecklist(text) {
  return /^\s*\d{1,3}\s*x?\s+\S/m.test(String(text ?? ''));
}

async function loadTappedOut(id) {
  const pageUrl = SITES.tappedout.pageUrl(id);
  const html = await fetchText(pageUrl);
  const arena = extractTextarea(html, 'mtga-textarea');

  if (arena && looksLikeADecklist(arena)) {
    return splitArenaExport(arena);
  }

  // The page had no export block. Fall back to the plain-text endpoint: it still
  // carries every card, and only the commander has to be pointed at by hand.
  const plain = await fetchText(`${pageUrl}?fmt=txt`, { accept: 'text/plain,*/*;q=0.8' });
  if (looksLikeADecklist(plain)) {
    return { name: '', text: plain.replace(/\r\n?/g, '\n').trim() };
  }
  return { name: '', text: '' };
}

// ── Moxfield ─────────────────────────────────────────────────────

/** One Moxfield board → entries. The cards are a dict keyed by their own id. */
function moxfieldBoard(boards, key) {
  return named(Object.values(boards?.[key]?.cards ?? {}).map((entry) => ({
    quantity: Number(entry?.quantity) > 0 ? Number(entry.quantity) : 1,
    name: entry?.card?.name,
    set: entry?.card?.set,
    collectorNumber: entry?.card?.cn,
  })));
}

async function loadMoxfield(id) {
  const deck = await fetchJson(`https://api2.moxfield.com/v3/decks/all/${encodeURIComponent(id)}`);
  const boards = deck?.boards ?? {};

  // ⚠️ Only these three. `maybeboard` is cards the deck is CONSIDERING — one
  // measured deck had 197 of them — and companions, tokens, stickers, attractions
  // and the rest are not cards in a Commander deck. A section this app would
  // ignore anyway is noise in the box the user is asked to check.
  return {
    name: typeof deck?.name === 'string' ? deck.name.trim() : '',
    text: decklistText({
      commanders: moxfieldBoard(boards, 'commanders'),
      main: moxfieldBoard(boards, 'mainboard'),
      sideboard: moxfieldBoard(boards, 'sideboard'),
    }),
  };
}

// ── Archidekt ────────────────────────────────────────────────────

function archidektEntry(entry) {
  return {
    quantity: Number(entry?.quantity) > 0 ? Number(entry.quantity) : 1,
    name: entry?.card?.oracleCard?.name,
    set: entry?.card?.edition?.editioncode,
    collectorNumber: entry?.card?.collectorNumber,
  };
}

async function loadArchidekt(id) {
  const deck = await fetchJson(`https://archidekt.com/api/decks/${encodeURIComponent(id)}/`);
  const cards = Array.isArray(deck?.cards) ? deck.cards : [];
  const categories = new Map(
    (Array.isArray(deck?.categories) ? deck.categories : [])
      .filter((c) => typeof c?.name === 'string')
      .map((c) => [c.name, c]),
  );
  const catsOf = (entry) => (Array.isArray(entry?.categories) ? entry.categories : []);

  // Archidekt has no sideboard: it has CATEGORIES, and a category can be marked
  // as not part of the deck. That is where the Maybeboard lives, and excluding
  // those entries is what made six of six measured decks come to exactly 100.
  const inDeck = cards.filter(
    (entry) => !catsOf(entry).some((n) => categories.get(n)?.includedInDeck === false),
  );

  const byName = inDeck.filter((entry) => catsOf(entry).some((n) => n.toLowerCase() === 'commander'));
  // ⚠️ The fallback for a RENAMED commander category — one of the six had called
  // it "Turn 2 ramp" — is Archidekt's own premier flag. Bounded at two, because
  // a premier category is only reliably the commander when it holds a legal
  // number of them; anything else is a category we have misread, and a wrong
  // commander is worse than asking.
  const byPremier = inDeck.filter((entry) => catsOf(entry).some((n) => categories.get(n)?.isPremier === true));
  const commanders = byName.length > 0 ? byName
    : (byPremier.length > 0 && byPremier.length <= 2 ? byPremier : []);

  const commanderSet = new Set(commanders);
  return {
    name: typeof deck?.name === 'string' ? deck.name.trim() : '',
    text: decklistText({
      commanders: named(commanders.map(archidektEntry)),
      main: named(inDeck.filter((entry) => !commanderSet.has(entry)).map(archidektEntry)),
    }),
  };
}

// ── the entry point ──────────────────────────────────────────────

/**
 * Fetch a deck by link.
 *
 * Resolves with a RESULT rather than throwing across IPC: the renderer shows
 * `message` to the user, and an exception thrown out of an ipcMain handler
 * arrives there wrapped in "Error invoking remote method", which is not a
 * sentence anyone should have to read.
 */
async function fetchDeck(rawUrl) {
  let deck;
  try {
    deck = parseDeckUrl(rawUrl);
  } catch (e) {
    return { ok: false, code: e.code ?? 'badUrl', message: e.message };
  }

  try {
    const { name, text } = await SITES[deck.site].load(deck.id);

    if (!looksLikeADecklist(text)) {
      return {
        ok: false,
        code: 'noDecklist',
        message: `${deck.label} answered, but there were no cards in that deck. If it is private, `
          + 'open it in your browser and paste the list instead.',
      };
    }
    if (text.length > LIMITS.textMaxBytes) {
      return {
        ok: false,
        code: 'tooLarge',
        message: 'That decklist is too long to be a deck. Import it by pasting the part you want.',
      };
    }

    return {
      ok: true,
      site: deck.site,
      sourceUrl: deck.url,
      name,
      text,
      commanderKnown: /^commander\s*$/im.test(text),
    };
  } catch (e) {
    return { ok: false, code: e.code ?? 'failed', message: explain(e, deck) };
  }
}

/** A network failure, said in a way that tells the user what to do about it. */
function explain(e, deck) {
  const code = e?.code ?? '';
  const host = new URL(deck.url).hostname;
  if (code === 'http404' || code === 'http400') {
    return `${deck.label} has no deck at ${deck.url}. Check the link — the deck may have been `
      + 'deleted, renamed, or made private.';
  }
  if (code === 'http403' || code === 'http401') {
    return `${deck.label} would not show that deck (it may be private or unlisted). Open it in `
      + 'your browser while signed in and paste the list instead.';
  }
  if (code === 'http429') {
    return `${deck.label} is asking us to slow down. Wait a minute and try again.`;
  }
  if (code === 'idleTimeout' || code === 'ETIMEDOUT') {
    return `${deck.label} stopped responding. Check your connection and try again.`;
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ECONNREFUSED' || code === 'ECONNRESET') {
    return `Could not reach ${host}. Check your internet connection — everything else in this app `
      + 'works offline, but importing from a link does not.';
  }
  if (/^http5\d\d$/.test(code)) {
    return `${deck.label} had a server error (${code.slice(4)}). Try again in a few minutes.`;
  }
  if (code === 'badJson') {
    return `${deck.label} answered with something this app could not read as a deck. If it keeps `
      + 'happening, paste the list instead.';
  }
  return `Could not import that deck: ${e?.message ?? String(e)}`;
}

module.exports = {
  USER_AGENT,
  ALLOWED_HOSTS,
  LINK_HOSTS,
  SITES,
  LIMITS,
  DeckFetchError,
  assertAllowedUrl,
  parseDeckUrl,
  siteList,
  decodeEntities,
  extractTextarea,
  splitArenaExport,
  looksLikeADecklist,
  decklistText,
  fetchDeck,
};
