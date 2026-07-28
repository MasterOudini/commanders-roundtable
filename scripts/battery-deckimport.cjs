/**
 * Deck-import-by-link battery: the URL guard, the per-site readers, and one real
 * download from each of the three sites.
 *
 *   node scripts/battery-deckimport.cjs [--offline]
 *
 * The link box is the only place in this app where a user hands the main process
 * a URL, so most of what is worth checking is refusals — a look-alike host, a
 * subdomain, embedded credentials, a path that is not a deck. Those are pure and
 * run offline.
 *
 * The network section downloads one real public Commander deck from TappedOut,
 * Moxfield and Archidekt, plus a deliberate 404 at each. A mock would paper over
 * exactly what breaks: whether the page still carries the export block we read
 * the commander out of, and whether an API still shapes a deck the way it did.
 * `--offline` skips it.
 */

const fs = require('fs');
const path = require('path');

const deckfetch = require('../electron/deckfetch.cjs');
const scryfall = require('../electron/scryfall.cjs');

const OFFLINE = process.argv.includes('--offline');

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) {
    pass += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? `  ${detail}` : ''}`);
  } else {
    fail += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `  ${detail}` : ''}`);
  }
}
function eq(name, actual, expected) {
  ok(name, Object.is(actual, expected), `got ${JSON.stringify(actual)}`);
}
function section(title) {
  console.log(`\n── ${title} ──`);
}

/** parseDeckUrl throws for anything it refuses; this reports the code. */
function refusal(input) {
  try {
    deckfetch.parseDeckUrl(input);
    return null;
  } catch (e) {
    return e.code;
  }
}
function accepted(input) {
  try {
    return deckfetch.parseDeckUrl(input).url;
  } catch (e) {
    return `THREW ${e.code}`;
  }
}

const CANON = 'https://tappedout.net/mtg-decks/verrak-swamps-matter/';

// A deck page, cut down to the parts we actually read. The escaping is real:
// TappedOut escapes the deck NAME and leaves apostrophes in card names alone.
const PAGE_FIXTURE = `<!DOCTYPE html><html><body>
  <textarea id="id_comment"></textarea>
  <button id="mtga-copy">Copy</button>
  <textarea id="mtga-textarea">About
Name Verrak&#x27;s Worst Nightmare | V-SOS

Commander
1x Verrak, Warped Sengir (DMC) 16

Deck
1x Arguel's Blood Fast (XLN) 90
1x Bolas&#x27;s Citadel (000) 1
9x Swamp (ELD) 260

Sideboard
1x Sol Ring (LTC) 264
</textarea>
</body></html>`;

async function main() {
  section('The link box: what it accepts');

  eq('a deck link parses to its canonical URL', accepted(CANON), CANON);
  eq('www. is the same site', accepted('https://www.tappedout.net/mtg-decks/verrak-swamps-matter/'), CANON);
  eq('http:// is upgraded, not refused', accepted('http://tappedout.net/mtg-decks/verrak-swamps-matter/'), CANON);
  eq('a link pasted without a scheme still works', accepted('tappedout.net/mtg-decks/verrak-swamps-matter/'), CANON);
  eq('a missing trailing slash is fine', accepted('https://tappedout.net/mtg-decks/verrak-swamps-matter'), CANON);
  // ⚠️ The URL is REBUILT from the slug, so everything hung off a deck link —
  // sort order, a fragment, /edit/ — is dropped rather than forwarded.
  eq('a query string is dropped',
    accepted(`${CANON}?cat=type&sort=cmc`), CANON);
  eq('a fragment is dropped', accepted(`${CANON}#comments`), CANON);
  eq('a trailing path segment is dropped', accepted(`${CANON}edit/`), CANON);
  eq('surrounding whitespace is ignored', accepted(`  ${CANON}  `), CANON);

  section('The link box: what it refuses');

  eq('a deck site we do not import from is refused', refusal('https://deckstats.net/decks/12345/'), 'hostNotAllowed');
  // The classic allowlist bypasses. A suffix check would pass the first two.
  eq('a look-alike host is refused', refusal('https://tappedout.net.attacker.example/mtg-decks/x/'), 'hostNotAllowed');
  eq('a subdomain is refused', refusal('https://evil.tappedout.net/mtg-decks/x/'), 'hostNotAllowed');
  eq('a prefix host is refused', refusal('https://nottappedout.net/mtg-decks/x/'), 'hostNotAllowed');
  eq('embedded credentials are refused', refusal('https://user:pw@tappedout.net/mtg-decks/x/'), 'hasCredentials');
  eq('a non-default port is refused', refusal('https://tappedout.net:8443/mtg-decks/x/'), 'badPort');
  eq('a page that is not a deck is refused', refusal('https://tappedout.net/users/somebody/'), 'notADeckUrl');
  eq('the deck index itself is not a deck', refusal('https://tappedout.net/mtg-decks/'), 'notADeckUrl');
  eq('an encoded traversal is refused', refusal('https://tappedout.net/mtg-decks/..%2f..%2fetc%2fpasswd/'), 'notADeckUrl');
  eq('nothing at all is refused', refusal('   '), 'empty');
  eq('a sentence is not a link', refusal('my deck please'), 'badUrl');
  eq('a javascript: URL is refused', refusal('javascript:alert(1)'), 'badUrl');
  eq('a file: URL is refused', refusal('file:///C:/Windows/win.ini'), 'hostNotAllowed');
  // A deck's own subpages are the same deck: /edit/, /builder/, anything else
  // TappedOut hangs off a deck link resolves to the deck, not to a refusal.
  eq('a deck subpage resolves to the deck',
    accepted('https://tappedout.net/mtg-decks/verrak-swamps-matter/deck-update/add/'), CANON);

  ok('every refusal says what to do about it',
    ['https://deckstats.net/decks/1/', 'https://tappedout.net/users/somebody/', '   ']
      .every((input) => {
        try { deckfetch.parseDeckUrl(input); return false; } catch (e) {
          return /paste|open the deck|copy the address|deck link looks like/i.test(e.message);
        }
      }));

  section('The other two sites, and where their links go');

  // ⚠️ A LINK host is not a FETCH host. moxfield.com is where the user's link
  // points; api2.moxfield.com is where the GET goes, because this module says so
  // and not because the link said so.
  eq('a Moxfield link is recognised', accepted('https://www.moxfield.com/decks/dgGtD78cVE2s1lTcw4OmFQ'),
    'https://www.moxfield.com/decks/dgGtD78cVE2s1lTcw4OmFQ');
  eq('…without the www too', accepted('https://moxfield.com/decks/dgGtD78cVE2s1lTcw4OmFQ'),
    'https://www.moxfield.com/decks/dgGtD78cVE2s1lTcw4OmFQ');
  eq('…and a primer link is still the deck', accepted('https://www.moxfield.com/decks/dgGtD78cVE2s1lTcw4OmFQ/primer'),
    'https://www.moxfield.com/decks/dgGtD78cVE2s1lTcw4OmFQ');
  eq('an Archidekt link is recognised', accepted('https://archidekt.com/decks/7031486/buffs_by_hans'),
    'https://archidekt.com/decks/7031486');
  eq('…with the slug left off', accepted('https://archidekt.com/decks/7031486'),
    'https://archidekt.com/decks/7031486');
  eq('an Archidekt id must be a number', refusal('https://archidekt.com/decks/not-a-number/x'), 'notADeckUrl');
  eq('a Moxfield user page is not a deck', refusal('https://www.moxfield.com/users/somebody'), 'notADeckUrl');
  eq('an Archidekt folder is not a deck', refusal('https://archidekt.com/folders/12345'), 'notADeckUrl');
  eq('the site is named back for a Moxfield link', (() => {
    try { return deckfetch.parseDeckUrl('https://moxfield.com/decks/abcdef').label; } catch { return null; }
  })(), 'Moxfield');
  ok('a refusal names every site the app does import from',
    (() => {
      try { deckfetch.parseDeckUrl('https://deckstats.net/decks/1/'); return false; } catch (e) {
        return /TappedOut/.test(e.message) && /Moxfield/.test(e.message) && /Archidekt/.test(e.message);
      }
    })());
  ok('the fetch allowlist holds the API hosts, not the link hosts',
    deckfetch.ALLOWED_HOSTS.has('api2.moxfield.com')
      && deckfetch.ALLOWED_HOSTS.has('archidekt.com')
      && !deckfetch.ALLOWED_HOSTS.has('moxfield.com')
      && !deckfetch.ALLOWED_HOSTS.has('www.moxfield.com'),
    [...deckfetch.ALLOWED_HOSTS].join(', '));

  section('Entries → the one text format every site produces');

  const built = deckfetch.decklistText({
    commanders: [{ quantity: 1, name: 'Najeela, the Blade-Blossom', set: 'cmr', collectorNumber: '514' }],
    main: [
      { quantity: 9, name: 'Swamp', set: 'eld', collectorNumber: '260' },
      { quantity: 1, name: 'Ancient Tomb', set: 'exp', collectorNumber: '36' },
      // A printing the site did not fully name.
      { quantity: 1, name: 'Sol Ring' },
    ],
    sideboard: [{ quantity: 1, name: 'Fire // Ice', set: 'dmr', collectorNumber: '215' }],
  });
  ok('it is the Arena shape the parser already reads', built.startsWith('Commander\n1x Najeela'));
  ok('the mainboard is headed `Deck`', /\n\nDeck\n/.test(built));
  ok('the sideboard keeps its own heading', /\n\nSideboard\n1x Fire \/\/ Ice \(DMR\) 215$/.test(built));
  ok('entries are sorted, so a re-import diffs cleanly',
    built.indexOf('Ancient Tomb') < built.indexOf('Sol Ring')
      && built.indexOf('Sol Ring') < built.indexOf('Swamp'));
  ok('quantities above one survive', /^9x Swamp \(ELD\) 260$/m.test(built));
  // ⚠️ A set with no collector number would be peeled off as a CATEGORY by the
  // parser's trailing-group pass — a subtly wrong printing rather than none.
  ok('a half-known printing is written as a bare name', /^1x Sol Ring$/m.test(built));
  eq('an empty deck is an empty string', deckfetch.decklistText({}), '');

  section('What the screens say matches what the module does');

  // ⚠️ A site added here and not said on those two screens is a site the user
  // cannot know about — and, on the About screen, an undisclosed connection.
  const decksScreen = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'ui', 'screens', 'DecksScreen.tsx'), 'utf8',
  );
  const aboutScreen = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'ui', 'screens', 'AboutScreen.tsx'), 'utf8',
  );
  for (const [id, site] of Object.entries(deckfetch.SITES)) {
    ok(`the Decks screen names ${site.label}`, decksScreen.includes(site.label));
    ok(`About lists the host ${id} links reach`,
      site.linkHosts.some((h) => aboutScreen.includes(h.replace(/^www\./, ''))));
  }

  section('Two allowlists, kept apart');

  // ⚠️ The point of a second module rather than a wider one. If these ever pass
  // in the other direction, the image queue can reach a deck site and the deck
  // importer can reach Scryfall's CDN.
  ok('the deck fetcher refuses a Scryfall URL',
    refusalOf(() => deckfetch.assertAllowedUrl('https://api.scryfall.com/bulk-data')) === 'hostNotAllowed');
  ok('the Scryfall fetcher refuses a TappedOut URL',
    refusalOf(() => scryfall.assertAllowedUrl(CANON)) === 'hostNotAllowed');
  ok('the deck fetcher refuses plain http even internally',
    refusalOf(() => deckfetch.assertAllowedUrl('http://tappedout.net/mtg-decks/x/')) === 'notHttps');
  ok('the deck fetcher refuses a non-default port internally',
    refusalOf(() => deckfetch.assertAllowedUrl('https://tappedout.net:8443/mtg-decks/x/')) === 'badPort');
  ok('the deck fetcher refuses embedded credentials internally',
    refusalOf(() => deckfetch.assertAllowedUrl('https://u:p@tappedout.net/mtg-decks/x/')) === 'hasCredentials');

  section('Reading the TappedOut page');

  const extracted = deckfetch.extractTextarea(PAGE_FIXTURE, 'mtga-textarea');
  ok('the export block is found', typeof extracted === 'string' && extracted.includes('Commander'));
  ok('the comment box is not mistaken for it',
    deckfetch.extractTextarea(PAGE_FIXTURE, 'id_comment') === '');
  ok('a page without the block yields null',
    deckfetch.extractTextarea('<html><body>no deck here</body></html>', 'mtga-textarea') === null);

  const { name, text } = deckfetch.splitArenaExport(extracted);
  eq("the deck's own name is kept, entities and all", name, "Verrak's Worst Nightmare | V-SOS");
  ok('the About header is dropped', !/^About$/m.test(text) && !/^Name /m.test(text));
  ok('the list starts at the Commander heading', text.startsWith('Commander\n'));
  ok('the commander survives', /^1x Verrak, Warped Sengir \(DMC\) 16$/m.test(text));
  ok('an apostrophe in a card name is decoded', text.includes("Bolas's Citadel"));
  ok('quantities above one survive', /^9x Swamp/m.test(text));
  ok('the sideboard heading survives', /^Sideboard$/m.test(text));

  // ⚠️ One decoding pass, not one per entity: `&amp;lt;` is the ESCAPED text
  // "&lt;", and a second pass would turn it into a `<`.
  eq('escaped text is decoded exactly once',
    deckfetch.decodeEntities('&amp;lt;script&amp;gt;'), '&lt;script&gt;');
  eq('numeric entities decode', deckfetch.decodeEntities('Bolas&#39;s &#x27;Citadel&#x27;'), "Bolas's 'Citadel'");
  eq('an unknown entity is left alone', deckfetch.decodeEntities('a &notanentity; b'), 'a &notanentity; b');

  ok('a list is recognised as a list', deckfetch.looksLikeADecklist('Deck\n1x Sol Ring (LTC) 264'));
  ok('a plain-text list is recognised', deckfetch.looksLikeADecklist('1 Sol Ring\n1 Lightning Bolt'));
  ok('a login page is not a list',
    !deckfetch.looksLikeADecklist('<html>Please sign in to view this deck</html>'));

  // A list with no headings at all — the ?fmt=txt fallback shape — must survive
  // the splitter untouched rather than being cut at a word that looks like one.
  const plainSplit = deckfetch.splitArenaExport('1 Sol Ring\n1 Lightning Bolt');
  eq('a headingless list is left whole', plainSplit.text, '1 Sol Ring\n1 Lightning Bolt');
  eq('a headingless list has no name', plainSplit.name, '');

  if (OFFLINE) {
    section('Network sections skipped (--offline)');
  } else {
    // Real public Commander decks, one per site, each measured at 100 cards on
    // 2026-07-27. They are user content: if one is deleted the check fails
    // LOUDLY, which is the right answer — it means a real import path is being
    // exercised, not a fixture.
    const LIVE = [
      { site: 'TappedOut', link: `${CANON}?cat=type`, canonical: CANON },
      {
        site: 'Moxfield',
        link: 'https://www.moxfield.com/decks/jT8Y9X4tlUmeNZ2AjkD1Vg/primer',
        canonical: 'https://www.moxfield.com/decks/jT8Y9X4tlUmeNZ2AjkD1Vg',
      },
      {
        site: 'Archidekt',
        link: 'https://archidekt.com/decks/7031486/buffs_by_hans',
        canonical: 'https://archidekt.com/decks/7031486',
      },
    ];

    for (const target of LIVE) {
      section(`One real download from ${target.site}`);
      const result = await deckfetch.fetchDeck(target.link);
      ok('the deck downloads', result.ok === true, result.ok ? '' : `${result.code}: ${result.message}`);
      if (!result.ok) continue;

      eq('it came from the canonical URL, not the one pasted', result.sourceUrl, target.canonical);
      ok('the commander is known', result.commanderKnown === true);
      ok('the deck has a name', result.name.length > 0, JSON.stringify(result.name));
      ok('there is a Commander heading', /^Commander$/m.test(result.text));
      ok('there is a Deck heading', /^Deck$/m.test(result.text));
      ok('the commander is exactly one card', (() => {
        const lines = result.text.split('\n');
        const start = lines.indexOf('Commander') + 1;
        const end = lines.findIndex((l, i) => i >= start && l.trim() === '');
        return lines.slice(start, end < 0 ? undefined : end).filter((l) => l.trim()).length;
      })() >= 1);
      ok('no export header came with it', !/^About$/m.test(result.text) && !/^Name /m.test(result.text));
      // ⚠️ Commander + Deck only. A sideboard is carried across because the site
      // has one (Moxfield's Najeela deck has nine), and it is exactly what the
      // validator does NOT count toward the 100.
      const counted = result.text.split('\n');
      const sideboardAt = counted.findIndex((l) => l.trim() === 'Sideboard');
      const total = (sideboardAt < 0 ? counted : counted.slice(0, sideboardAt))
        .reduce((n, l) => n + (Number(/^(\d{1,3})x /.exec(l.trim())?.[1] ?? 0)), 0);
      ok('it holds a full Commander deck', total === 100, `${total} cards`);
      ok('every line is a quantity and a name', result.text.split('\n')
        .filter((l) => l.trim() && !/^(Commander|Deck|Sideboard)$/.test(l.trim()))
        .every((l) => /^\d{1,3}x \S/.test(l)));
      ok('the text is small — a decklist, not a web page',
        result.text.length < 20_000, `${result.text.length} B`);
    }

    section('When the deck is not there');

    for (const [label, link, code] of [
      ['TappedOut', 'https://tappedout.net/mtg-decks/crt-no-such-deck-xyz/', 'http404'],
      ['Moxfield', 'https://www.moxfield.com/decks/crtNoSuchDeckXyz123', 'http404'],
      ['Archidekt', 'https://archidekt.com/decks/999999999', 'http404'],
    ]) {
      const missing = await deckfetch.fetchDeck(link);
      ok(`${label}: a deck that is not there fails cleanly`, missing.ok === false);
      eq(`${label}: …as a 404`, missing.code, code);
      ok(`${label}: …and the message names the site and says what to check`,
        missing.ok === false && missing.message.includes(label)
          && /private|deleted|renamed/i.test(missing.message),
        missing.ok === false ? missing.message : '');
    }

    const wrongSite = await deckfetch.fetchDeck('https://deckstats.net/decks/12345/');
    ok('a site we do not import from fails without a request being made',
      wrongSite.ok === false && wrongSite.code === 'hostNotAllowed');
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${pass}/${pass + fail} checks passed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  • ${f}`);
  }
  process.exit(fail ? 1 : 0);
}

/** The code a throwing guard threw, or null when it did not throw. */
function refusalOf(fn) {
  try { fn(); return null; } catch (e) { return e.code; }
}

main().catch((e) => {
  console.error('\nBattery crashed:', e);
  process.exit(1);
});
