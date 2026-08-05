// "with power 4 or greater", "with mana value 3 or less" — CR 115.4 restrictions
// on what a clause may be pointed at. See D139.
//
// ⚠️ THIS WAS WORSE THAN THE HOLES D138 CLOSED. Those restrictions were RECORDED
// and unchecked; this one was never recorded at all. `Smite the Monstrous`
// ("Destroy target creature with power 4 or greater") parsed to
// `kinds:['creature'], confident:true, unenforced:[]` — the qualifier matched no
// noun entry, so it left no trace anywhere. The app would destroy a 1/1 with it,
// `tier3.ts` said nothing because there was nothing to say, and the prompt bar
// quoted the clause as "target creature", a rule the card does not have.
//
// ⚠️ AND THE ORDER OF THE FIX IS THE POINT. D138 refused to widen the effect
// vocabulary for "with mana value 3 or less" because `TargetSpec` had no field
// for it. Enforce first, admit the wording second — the other way round is how a
// card that reads correctly runs incorrectly.

import { describe, expect, test } from 'vitest';
import { Game } from './game';
import { faceOf } from './oracle';
import { candidatesFromState, targetAllowed } from './targets';
import { parseTargetClauses } from '../data/targetParse';
import { advanceUntil, findAnywhere, fullControl, must, ORACLE, put, startedGame } from './testing/harness';

const LANDS = ['Plains', 'Plains', 'Plains', 'Plains', 'Mountain'];
const DECK = [
  'Smite the Monstrous',
  'Eternal Isolation',
  'Disdainful Stroke',
  'Unearth',
  ...LANDS,
  'Grizzly Bears',
  'Colossal Dreadmaw',
  'Lightning Bolt',
];

function game(): Game {
  const g = startedGame({ players: 2, decks: [DECK, DECK] });
  fullControl(g, 'p1');
  for (const l of LANDS) put(g, 'p1', l);
  return g;
}

const SRC = { controller: 'p1' as const, colors: [] };

function specOf(name: string) {
  const spec = faceOf(ORACLE.byName(name)!, 0).targets[0];
  if (!spec) throw new Error(`${name} has no target spec`);
  return spec;
}

function candidate(g: Game, id: string) {
  const cands = candidatesFromState(g.state, { oracle: ORACLE, scripts: g.deps.scripts });
  const c = cands.find((x) => x.choice.kind === 'card' && x.choice.id === id);
  if (!c) throw new Error(`no candidate for ${id}`);
  return c;
}

describe('the clause is READ (D139)', () => {
  test('“with power 4 or greater” becomes a restriction, not silence', () => {
    const spec = specOf('Smite the Monstrous');
    expect(spec.numeric).toEqual({ attr: 'power', cmp: 'atLeast', value: 4 });
    // ⚠️ And `text` grew with it. Before this the prompt bar showed "target
    // creature" for a card that says "target creature with power 4 or greater" —
    // the app quoting a rule the card does not have.
    expect(spec.text).toBe('target creature with power 4 or greater');
  });

  test('“with mana value 3 or less” is the other comparator', () => {
    expect(specOf('Unearth').numeric).toEqual({ attr: 'manaValue', cmp: 'atMost', value: 3 });
  });

  /**
   * WARNING: BOTH ORDERS, because the two qualifier readers must behave the
   * same (D140). A branch that RETURNS instead of recursing silently drops
   * whatever follows it, and that is exactly what the graveyard branch did:
   * 'target creature card IN YOUR GRAVEYARD with mana value 4 or less' read
   * the zone and threw the number away, with `text` truncated to match. One
   * printed card needs it (`Too Evil to Stay Dead`); the asymmetry is the
   * reason to fix it, because two readers that disagree is a bug waiting for a
   * third qualifier to be added.
   */
  test('a zone and a number are both read, in either order', () => {
    const numFirst = parseTargetClauses(
      'Return target creature card with mana value 3 or less from your graveyard to your hand.',
    )[0];
    expect(numFirst).toMatchObject({
      zones: ['graveyard'],
      controller: 'you',
      numeric: { attr: 'manaValue', cmp: 'atMost', value: 3 },
    });

    const zoneFirst = parseTargetClauses(
      'Return target creature card in your graveyard with mana value 4 or less to the battlefield.',
    )[0];
    expect(zoneFirst).toMatchObject({
      zones: ['graveyard'],
      controller: 'you',
      numeric: { attr: 'manaValue', cmp: 'atMost', value: 4 },
    });
    // …and the printed span covers the whole clause both ways round.
    expect(zoneFirst?.text).toBe('target creature card in your graveyard with mana value 4 or less');
  });

  test('a clause with no qualifier still carries none', () => {
    expect(specOf('Lightning Bolt').numeric).toBeNull();
  });
});

describe('the clause is ENFORCED', () => {
  /**
   * ⚠️ The pair is the test. `Grizzly Bears` (2/2) and `Colossal Dreadmaw` (6/6)
   * differ in exactly the number the clause names, so a predicate that ignored
   * it would light up both — which is precisely what happened before D139.
   */
  test('power 4 or greater admits the 6/6 and refuses the 2/2', () => {
    const g = game();
    const bears = put(g, 'p2', 'Grizzly Bears');
    const dino = put(g, 'p2', 'Colossal Dreadmaw');
    const spec = specOf('Smite the Monstrous');

    expect(targetAllowed(spec, SRC, candidate(g, bears))).toBe(false);
    expect(targetAllowed(spec, SRC, candidate(g, dino))).toBe(true);
  });

  /**
   * ⚠️ **DERIVED, NOT PRINTED** — CR 613 settles characteristics before targeting
   * legality is checked, so a pumped 2/2 really is a legal target for "power 4 or
   * greater". Reading the printed value would REFUSE a legal choice, which is
   * the one direction `targets.ts` may never be wrong in.
   */
  test('a pumped creature counts at its CURRENT power', () => {
    const g = game();
    const bears = put(g, 'p2', 'Grizzly Bears');
    const spec = specOf('Smite the Monstrous');
    expect(targetAllowed(spec, SRC, candidate(g, bears))).toBe(false);

    // ⚠️ `ManualSetPt` SETS the value, it does not add to it — the Tier-3 tool
    // is "make this creature a 5/2", not "give it +3/+0".
    must(g.submit({ t: 'ManualSetPt', player: 'p1', card: bears, power: 5, toughness: 2 }));
    expect(candidate(g, bears).power).toBe(5);
    expect(targetAllowed(spec, SRC, candidate(g, bears))).toBe(true);
  });

  /**
   * ⚠️ A SPELL ON THE STACK HAS A MANA VALUE and 504 lines in the format restrict
   * on it. Leaving it null to match the stack candidate's power and toughness
   * would make every such counterspell refuse everything.
   */
  test('a counterspell reads the mana value of a spell on the stack', () => {
    const g = game();
    const bolt = findAnywhere(g, 'p1', 'Lightning Bolt');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'hand', player: 'p1' } }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));

    const cands = candidatesFromState(g.state, { oracle: ORACLE, scripts: g.deps.scripts });
    const onStack = cands.find((c) => c.choice.kind === 'stack');
    expect(onStack?.manaValue).toBe(1);
    // Disdainful Stroke wants 4 or greater; a Bolt is 1.
    expect(targetAllowed(specOf('Disdainful Stroke'), SRC, onStack!)).toBe(false);
  });

  /**
   * ⚠️ **A MISSING NUMBER REFUSES.** A land has no power, so it cannot satisfy a
   * clause about power — and this is the one place in `targets.ts` where absence
   * NARROWS rather than widens. It is right because the SPEC is known: the parser
   * read the restriction, so the asymmetry that protects unread clauses does not
   * apply.
   */
  test('an object with no such number is refused, not waived', () => {
    const g = game();
    const land = put(g, 'p2', 'Swamp');
    expect(candidate(g, land).power).toBeNull();
    expect(targetAllowed(specOf('Smite the Monstrous'), SRC, candidate(g, land))).toBe(false);
  });
});

describe('and the cards now run', () => {
  test('the destroy card is understood completely', () => {
    expect(ORACLE.byName('Smite the Monstrous')?.faces[0]?.effectMode).toBe('auto');
  });

  /**
   * ⚠️ **THE RESTRICTION IS READ EVEN WHEN THE EFFECT IS NOT**, and that
   * separation is worth pinning. `Eternal Isolation` is "Put target creature with
   * power 4 or greater on the BOTTOM OF ITS OWNER'S LIBRARY" — a destination this
   * effect vocabulary has no word for, so the card stays Tier 3. Its target spec
   * is still correct, which is what makes the aim veil honest on a card the
   * engine cannot resolve: the arrow lights up only the creatures the card can
   * legally be pointed at, and the player applies the effect by hand.
   */
  test('…and the restriction is read on a card the engine still cannot run', () => {
    expect(ORACLE.byName('Eternal Isolation')?.faces[0]?.effectMode).not.toBe('auto');
    expect(specOf('Eternal Isolation').numeric).toEqual({ attr: 'power', cmp: 'atLeast', value: 4 });
  });

  test('the spell resolves and kills only what it may', () => {
    const g = game();
    const dino = put(g, 'p2', 'Colossal Dreadmaw');
    const card = findAnywhere(g, 'p1', 'Smite the Monstrous');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'hand', player: 'p1' } }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: dino }] }));
    advanceUntil(g, (st) => st.stack.length === 0, 400);
    expect(g.state.cards[dino]?.zone.kind).toBe('graveyard');
  });

  /**
   * ⚠️ The host REJECTS an illegal aim rather than resolving it, which is the
   * end-to-end proof that the spec reaches the cast path and not only the veil.
   */
  test('aiming it at a 2/2 is rejected at the cast', () => {
    const g = game();
    const bears = put(g, 'p2', 'Grizzly Bears');
    const card = findAnywhere(g, 'p1', 'Smite the Monstrous');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'hand', player: 'p1' } }));
    const r = g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: bears }] });
    expect(r.ok).toBe(false);
  });
});
