// The accounting a shipped card script owes — M6.3t. See D147.
//
// ⚠️ **THIS GUARD EXISTS BEFORE THE THING IT GUARDS, ON PURPOSE.**
// `SHIPPED_SCRIPTS` is empty and M6.4 fills it. The rule it enforces has been
// written in comments since D122 and repeated in D128, D130, D133, D134 and
// D146, and a rule that lives only in comments is the one D122 caught being
// broken across 16,020 cards: in this app, silence on a card means "handled".
//
// The rule: **a card the engine RUNS must not be a card the app DISCLAIMS.**
//   · `engineCompleteness(card).complete` must be true — otherwise the script
//     runs part of a card and the rest happens nowhere (D90).
//   · `tier3NotesFor(card)` must be empty — otherwise the hover panel tells the
//     player to handle by hand something the engine is already doing.
// Both, in the same commit as the script.

import { existsSync, createReadStream, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { describe, expect, test } from 'vitest';
import { SHIPPED_SCRIPTS } from '../engine/scripts/registry';
import { AJANIS_MANTRA, HUMILITY_SCRIPT } from '../engine/testing/cardScripts';
import { engineCompleteness } from './engineComplete';
import { tier3NotesFor } from './tier3';
import type { CardData } from './cardTypes';
import type { CardScript } from '../engine/scripts/api';

const NDJSON = join(process.env.CRT_DATA_DIR ?? join(homedir(), '.commanders-roundtable'), 'cards', 'cards.ndjson');
const HAVE_DB = existsSync(NDJSON);

/** Every Commander-legal card named by one of these scripts, by oracle id. */
async function cardsFor(scripts: readonly CardScript[]): Promise<Map<string, CardData>> {
  const want = new Set(scripts.map((s) => s.oracleId));
  const out = new Map<string, CardData>();
  if (want.size === 0) return out;
  const rl = createInterface({ input: createReadStream(NDJSON), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    let card: CardData;
    try {
      card = JSON.parse(line) as CardData;
    } catch {
      continue;
    }
    if (!want.has(card.oracleId) || out.has(card.oracleId)) continue;
    out.set(card.oracleId, card);
  }
  return out;
}

/** What the rule says about one script's card. `null` means it is satisfied. */
function violation(script: CardScript, card: CardData | undefined): string | null {
  if (!card) return `${script.name}: no Commander-legal printing found for ${script.oracleId}`;
  const verdict = engineCompleteness(card);
  if (!verdict.complete) {
    return `${card.name}: a script ships for it, but engineComplete still refuses it — ${verdict.leftover.join(' / ')}`;
  }
  const notes = tier3NotesFor(card);
  if (notes.length > 0) {
    return `${card.name}: a script ships for it, but tier3 still says "${notes.map((n) => n.what).join('", "')}"`;
  }
  return null;
}

describe.skipIf(!HAVE_DB)('what a shipped card script owes the player', () => {
  test('every shipped script names a card the app no longer disclaims', async () => {
    const cards = await cardsFor(SHIPPED_SCRIPTS);
    const bad = SHIPPED_SCRIPTS.map((s) => violation(s, cards.get(s.oracleId))).filter(
      (x): x is string => x !== null,
    );
    expect(bad).toEqual([]);
  }, 120_000);

  /**
   * ⚠️ **THE TEETH CHECK, and without it the test above is D128's
   * green-over-nothing** — `SHIPPED_SCRIPTS` is empty, so it passes over zero
   * cards and would go on passing if `violation` returned `null` unconditionally.
   *
   * The test registry is the right thing to point it at, because those scripts
   * are exactly what a shipped one must NOT look like: `Ajani's Mantra` is a
   * triggered ability, so `engineComplete` refuses it and `tier3.ts` prints "Its
   * ability text" on it — and it is not shipped, so both are correct. If either
   * of those two ever stops being true, this fails and the reason is worth
   * knowing either way.
   */
  test('and the check has teeth — the TEST scripts fail it, as they should', async () => {
    // ⚠️ Yotian Dissident held this post from D156 until it SHIPPED in D160 —
    // a shipped card cannot be the example of an unshipped one. `Humility`
    // took over: engineComplete refuses it (ability text a script does not
    // claim — the testing registry is not SHIPPED_SCRIPTS) and tier3 notes it,
    // and it is also the card the fuzz DECK teeth pin as never-dealt.
    const testScripts = [AJANIS_MANTRA, HUMILITY_SCRIPT];
    const cards = await cardsFor(testScripts);
    const bad = testScripts.map((s) => violation(s, cards.get(s.oracleId))).filter((x) => x !== null);
    expect(bad).toHaveLength(testScripts.length);
    expect(bad.join('\n')).toMatch(/engineComplete still refuses it|tier3 still says/);
  }, 120_000);

  test('the shipped list holds exactly the landed batches', () => {
    // ⚠️ Pinned so that landing a batch is a DELIBERATE edit here, with this
    // file's rule read on the way past — not a line added to an array. It was
    // pinned at 0 from D156 until M6.4a's first batch (D158) landed eight:
    // Soul Warden, Essence Warden, Radiant Fountain, Adventurer's Inn, Wall of
    // Blossoms, Wall of Omens, Baleful Strix, Onulet. M6.4b (D159) landed the
    // four the ActivatedDef seam unblocked: Arcane Encyclopedia, Deserted
    // Temple, Hedron Archive, War Room. M6.4c (D160) landed nineteen — the
    // first select.cjs batch at scale, 19 of 25 with the six refusals named.
    // M6.4d (D161) landed thirteen and taught the SELECTION two refusal shapes
    // its needs column could not see (spells; unenforced target clauses).
    // M6.4e (D162) landed thirteen of 25 — the twelve refusals are all cost or
    // prompt classes the ledger already names, six of them the general-
    // sacrifice chooser alone.
    // M6.4f (D163) landed nine of 25 — twelve slots were D162's refusals
    // re-offered (the REFUSED ledger in cardgenSelect now ends that tax), and
    // the four fresh refusals are named there with their classes.
    // M6.4g (D164) landed nineteen of 25 — the biggest batch of the arc, and
    // the one that found ctx.ids.nextInstance handing the SAME id to every
    // call in a resolve. Six refusals, all in the ledger.
    // M6.4h (D165) landed twenty-two of 25 — the cleanest batch yet: three
    // refusals (two sacrifice-choosers, one NEW remove-counter cost class).
    // M6.4i (D166) landed twenty-one of 25 — four refusals, one NEW class
    // (exile-SELF cost, named cheap: sacrificesSelf one event over).
    // M6.4s (D175) landed twenty-one of 25 — the first DiceRolled consumer
    // (Feywild Trickster rides the Tier-3 roll tool's own event), the
    // nontoken dies watcher, and the untap active.
    // M6.4t (D176) landed twenty-two of 25 — Glittermonger returns from the
    // D147 mana-ability misparse as a real def; both twins of one ETB-draw
    // text in a single batch; three refusals, all existing ledger classes.
    // M6.4u (D177) landed twenty-one of 25 — the two-sentence activated
    // resolve (Gnottvold: destroy + token, the Troll arriving past an
    // indestructible target), the fourth Benalish id, and TWO new refusal
    // classes (multi-sacrifice cost; sacrifice-event discriminator).
    // M6.4v (D178) landed eighteen of 25 — Grave Titan's enters-or-attacks
    // pair, the attacker-count Soldier (Haazda Marshal), Greed's life-cost
    // draw; THREE new refusal classes (alternative activation cost,
    // ability-word activated cost, graveyard-activated ability).
    // M6.4w (D179) landed twenty-one of 25 — the first MULTICOLORED cast
    // filter (Hero of Precinct One), the first upkeep trigger that TARGETS
    // (Harrier Griffin), the enchantment that wants to die (Hatching Plans);
    // THREE new refusal classes again (token-predicate sacrifice cost,
    // put-counter cost, draw-event discriminator — the last is Graf Mole's
    // finding one event over).
    // M6.4x (D180) landed twenty of 25 — the attacks-ALONE filter (Imperial
    // Subduer), Hornet Queen's FOUR-token entry, and the Plains-plural
    // parser bug Idyllic Grange's own test exposed (latent since D135);
    // two new refusal classes (snow activation cost, reveal-cost chooser).
    // M6.4z (D182) landed twenty-two of 25 — the first ATTACKS-OR-BLOCKS
    // pair (Jedit Ojanen, the first BlockersDeclared consumer), a FOUR-id
    // identical-text family (+1/+1-counter entries), and Jayemdae Tome
    // carrying Arcane Encyclopedia's exact text back to D159's first
    // activated; one new refusal class (last-drawn-card memory cost).
    // M6.4aa (D183) landed twenty-one of 25 — Jhoira's historic cast-watcher,
    // Keeper of Fables' non-Human combat-damage filter, Junktown's triple
    // Junk, three more Fisk-shape refuges and a Kami text twin; one new
    // refusal class (the gift mechanic).
    // M6.4ab (D184) landed twenty of 25 — ZERO new refusal classes (the
    // ledger's drainage working), Khalni Garden's token-paying entry-tapped
    // land, D139's numeric CEILING (Kor Line-Slinger) beside its floors, and
    // the land.cjs substring false-positive its own refusal exposed
    // (KINGFISHER_SCRIPT inside ITHILIEN_KINGFISHER_SCRIPT).
    // M6.4ac (D185) landed fifteen of 25 — the leanest batch of the arc,
    // because classification CORRECTED ITSELF mid-write: Lifeblood, Lifetap
    // and Linden moved to refusals when writing a resolve exposed that a
    // resolve cannot see the EVENT, so per-item wording on a batched event
    // under-fires (Aya's D163 class on taps and attacks). Four new classes
    // (kicker memory, explore mechanic, negated-type sacrifice predicate,
    // per-tap-entry granularity).
    // M6.4ad (D186) landed twenty of 25 — the first DefenderRef read in a
    // def (Meriadoc's "attack a player"), Mavren Fein's nontoken-Vampire
    // attack filter, the first counter-conditioned dies watcher
    // (Meltstrider), the first targeted attacks-or-blocks pair (Merfolk
    // Skyscout), the four Memorials, and the fifth Benalish id (Master
    // Decoy). Two new classes: scry/surveil event discriminator (Matoya —
    // no event marks a scry, D114 made the mode UI state) and the {Q}
    // untap-symbol activation cost (Merrow Grimeblotter).
    // M6.4ae (D187-D190): the engine unlocks' proof cards - Char and Fruition
    // are the FIRST SpellDef entries (the spell seam), Horizon Chimera the
    // DrewCards x per-item fan-out composition (D179's own named card).
    // M6.4ag (D192) - WAVE 1: sixteen SpellDefs from the D191-widened pool,
    // all rung 1 (the user's own decks) - rituals, wraths, fights, burn,
    // draw. Bedevil and Fall of the Hammer were pulled at draft time by
    // their own failing tests (spell target parse - see the REFUSED ledger).
    expect(SHIPPED_SCRIPTS).toHaveLength(1059);
  });
});

/**
 * ⚠️⚠️ **PRODUCT CODE MAY NEVER REACH FOR `NO_SCRIPTS`** — the other half of
 * D156’s split, and the direction that would be silent.
 *
 * `SHIPPED_REGISTRY` is what the app runs and `NO_SCRIPTS` is a genuinely empty
 * one for tests. They were ONE constant called `EMPTY_REGISTRY` until D156,
 * built from `SHIPPED_SCRIPTS`, so the name stopped being true the moment M6.4
 * landed anything. Splitting them fixed the tests; this stops the fix being
 * undone from the other side, where a product file reaching for the empty one
 * would make the app ignore every script it ships and nothing would fail.
 */
describe('the shipped registry and the empty one stay apart', () => {
  test('no product file imports NO_SCRIPTS', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry)) continue;
        // Tests may; so may the test harness and the registry that defines it.
        if (/\.test\.ts$/.test(entry)) continue;
        if (full.includes(join('engine', 'testing'))) continue;
        if (entry === 'registry.ts') continue;
        if (/\bNO_SCRIPTS\b/.test(readFileSync(full, 'utf8'))) offenders.push(relative(process.cwd(), full));
      }
    };
    walk(join(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });

  /** ⚠️ The teeth: the scan must be able to SEE a file that names it. */
  test('and the scan can see one', () => {
    const harness = readFileSync(join(process.cwd(), 'src', 'engine', 'testing', 'harness.ts'), 'utf8');
    expect(/\bNO_SCRIPTS\b/.test(harness)).toBe(true);
  });
});
/** ⚠️ Loud, so a machine with no card database cannot look like a passing run. */
describe.skipIf(HAVE_DB)('what a shipped card script owes the player', () => {
  test('SKIPPED — no card database', () => {
    // eslint-disable-next-line no-console
    console.warn(`No card database at ${NDJSON}. Run: node electron/cardsvc-worker.cjs --sync`);
    expect(HAVE_DB).toBe(false);
  });
});
