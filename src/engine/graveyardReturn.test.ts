// Returning a card from a graveyard — CR 400.7 — and the targeting hole that
// building it exposed. See D138.
//
// ⚠️ THE EIGHTH BUCKET SPLIT DECIDED THIS SHAPE. `chooseFromZone`'s
// graveyard-return alternative is 686 cards: 376 to a HAND, 312 to the
// BATTLEFIELD; and by what the clause is, 275 plain one-shot effects, 205
// trigger payloads, 137 activated payloads, 70 modal modes. Only the plain
// effect resolves by itself, and measured by the SENTENCE (D137's lesson) the
// five whole-card forms are worth 36 cards.
//
// ⚠️ AND THE REAL FIND WAS NOT THE EFFECT. `Raise Dead` parsed to
// `kinds:['card'], zones:[], unenforced:['creature card']` — and `targetAllowed`
// checked NEITHER the zone nor the type. Building the effect on that would have
// let a player return a LAND from an OPPONENT'S EXILE, on a card that reads
// correctly. The tests for that are the first block below.

import { describe, expect, test } from 'vitest';
import { Game } from './game';
import { replay, stateHash } from './log';
import { candidatesFromState, targetAllowed } from './targets';
import { faceOf } from './oracle';
import { parseEffects } from '../data/effectParse';
import {
  advanceUntil,
  findAnywhere,
  fullControl,
  must,
  ORACLE,
  put,
  startedGame,
} from './testing/harness';

const LANDS = ['Swamp', 'Swamp', 'Swamp', 'Swamp'];
const DECK = ['Raise Dead', 'Zombify', 'Regrowth', 'Relearn', ...LANDS, 'Grizzly Bears', 'Lightning Bolt'];

function game(): Game {
  const g = startedGame({ players: 2, decks: [DECK, DECK] });
  fullControl(g, 'p1');
  for (const l of LANDS) put(g, 'p1', l);
  return g;
}

/** Cast a spell at a card and let it resolve. */
function castAt(g: Game, name: string, target: string): void {
  const card = findAnywhere(g, 'p1', name);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'hand', player: 'p1' } }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: target }] }));
  advanceUntil(g, (s) => s.stack.length === 0, 400);
}

describe('the target clause, which was not enforced (D138)', () => {
  test('“from your graveyard” is read as a zone AND a controller', () => {
    const spec = ORACLE.byName('Raise Dead')?.faces[0]?.targets[0];
    expect(spec).toMatchObject({
      kinds: ['card'],
      zones: ['graveyard'],
      controller: 'you',
      cardTypes: ['Creature'],
    });
    // ⚠️ And the type is no longer DISCLAIMED, because it is now checked. A note
    // saying "the app will not check this" about something it does check is the
    // disclosure lying in the safe direction, which is still lying.
    expect(spec?.unenforced).not.toContain('creature card');
  });

  test('“target card” names no type, so nothing is narrowed away', () => {
    const spec = ORACLE.byName('Regrowth')?.faces[0]?.targets[0];
    expect(spec?.cardTypes).toEqual([]);
    expect(spec?.zones).toEqual(['graveyard']);
  });

  /** ⚠️ A DISJUNCTION: either type qualifies, never both required. */
  test('“instant or sorcery card” admits either', () => {
    const spec = ORACLE.byName('Relearn')?.faces[0]?.targets[0];
    expect(spec?.cardTypes).toEqual(['Instant', 'Sorcery']);
  });

  /**
   * ⚠️ **THE BUG THIS BLOCK EXISTS FOR.** Before D138 every one of these was a
   * LEGAL target for `Raise Dead`: a land in your own graveyard (wrong type), a
   * creature in an opponent's graveyard (wrong controller), and a creature in
   * exile (wrong zone). Each is checked separately, because each was a
   * different missing check and a single combined case would pass if any one of
   * them were re-broken.
   */
  test('Raise Dead can no longer take the three things it used to', () => {
    const g = game();
    const spec = faceOf(ORACLE.byName('Raise Dead')!, 0).targets[0]!;
    const src = { controller: 'p1' as const, colors: [] };

    const myLand = findAnywhere(g, 'p1', 'Swamp');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: myLand, to: { kind: 'graveyard', player: 'p1' } }));
    const theirBears = findAnywhere(g, 'p2', 'Grizzly Bears');
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: theirBears, to: { kind: 'graveyard', player: 'p2' } }));
    const myExiled = findAnywhere(g, 'p1', 'Grizzly Bears');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: myExiled, to: { kind: 'exile', player: 'p1' } }));

    const cands = candidatesFromState(g.state, { oracle: ORACLE, scripts: g.deps.scripts });
    const of = (id: string) => cands.find((c) => c.choice.kind === 'card' && c.choice.id === id)!;

    expect(targetAllowed(spec, src, of(myLand))).toBe(false); // wrong TYPE
    expect(targetAllowed(spec, src, of(theirBears))).toBe(false); // wrong CONTROLLER
    expect(targetAllowed(spec, src, of(myExiled))).toBe(false); // wrong ZONE
  });

  test('…and still takes the one thing it should', () => {
    const g = game();
    const spec = faceOf(ORACLE.byName('Raise Dead')!, 0).targets[0]!;
    const mine = findAnywhere(g, 'p1', 'Grizzly Bears');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mine, to: { kind: 'graveyard', player: 'p1' } }));
    const cands = candidatesFromState(g.state, { oracle: ORACLE, scripts: g.deps.scripts });
    const c = cands.find((x) => x.choice.kind === 'card' && x.choice.id === mine)!;
    expect(targetAllowed(spec, { controller: 'p1', colors: [] }, c)).toBe(true);
  });
});

describe('returning it (CR 400.7)', () => {
  test('the sentence is read, and the whole card now runs', () => {
    const raise = ORACLE.byName('Raise Dead')?.faces[0];
    expect(raise?.oracleText).toBe('Return target creature card from your graveyard to your hand.');
    expect(raise?.effectMode).toBe('auto');
    expect(raise?.effects[0]?.kind).toBe('returnFromGraveyard');

    const zombify = ORACLE.byName('Zombify')?.faces[0];
    expect(zombify?.effectMode).toBe('auto');
    expect(zombify?.effects[0]?.kind).toBe('reanimate');
  });

  test('Raise Dead puts the creature in its owner’s hand', () => {
    const g = game();
    const bears = findAnywhere(g, 'p1', 'Grizzly Bears');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    castAt(g, 'Raise Dead', bears);

    expect(g.state.zones.hand['p1']).toContain(bears);
    expect(g.state.zones.graveyard['p1']).not.toContain(bears);
  });

  /**
   * ⚠️ REANIMATION RUNS THE WHOLE ENTRY FUNNEL, which is why it is its own kind:
   * the card becomes a PERMANENT, so it is on the battlefield, untapped, and
   * summoning-sick like anything else that just arrived.
   */
  test('Zombify puts it on the battlefield, under the CASTER’s control', () => {
    const g = game();
    const bears = findAnywhere(g, 'p1', 'Grizzly Bears');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    castAt(g, 'Zombify', bears);

    expect(g.state.zones.battlefield).toContain(bears);
    expect(g.state.cards[bears]?.controller).toBe('p1');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  /**
   * ⚠️ **THE DESTINATION IS THE OWNER (`aim.owner`), NOT THE CASTER** — and it
   * is worth saying precisely because today those are always the same seat, so a
   * version that used the caster would pass every test in this file.
   *
   * A card always goes to its OWNER's graveyard (CR 404.3), so "a card sitting
   * in another player's graveyard" is a state this engine cannot reach: an
   * earlier draft of this test tried to build one with a manual move and simply
   * produced a card in the graveyard it already belonged to. The distinction
   * becomes real the moment anything casts from another player's graveyard, and
   * the code reads the owner now rather than being corrected then.
   */
  test('the destination is read from the OWNER of the card', () => {
    const g = game();
    const bears = findAnywhere(g, 'p1', 'Grizzly Bears');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    const owner = g.state.cards[bears]?.owner;
    expect(owner).toBe('p1');
    castAt(g, 'Raise Dead', bears);
    expect(g.state.zones.hand[owner!]).toContain(bears);
  });

  test('both spells replay to the same hash', () => {
    for (const name of ['Raise Dead', 'Zombify']) {
      const g = game();
      const bears = findAnywhere(g, 'p1', 'Grizzly Bears');
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
      castAt(g, name, bears);
      expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
    }
  });

  /**
   * ⚠️ **FOUR SHAPES SIT ONE CLAUSE PAST THIS VOCABULARY** and each is a
   * different rule: a COUNT ("up to two target creature cards" — admitted in
   * D299, when the consumer learned to run a clause once per pick; see
   * countedTargets.test.ts), a NUMERIC
   * restriction ("with mana value 3 or less" — `TargetSpec` has no field for
   * it), and the two battlefield qualifiers ("tapped", "under your control").
   * Every one of them CONTAINS a sentence this vocabulary reads, which is what
   * the anchors are for.
   *
   * ⚠️ Asked of `parseEffects` directly rather than of a fixture, because the
   * point is what the PARSER refuses — pinning it to card names would only
   * prove those cards are absent from the fixture set.
   */
  test('a sentence with one more clause in it is refused', () => {
    for (const text of [
      'Return target creature card from your graveyard to the battlefield tapped.',
      'Return target creature card from your graveyard to the battlefield under your control.',
    ]) {
      expect(parseEffects(text, 'X', true).mode).not.toBe('auto');
    }
    /**
     * ⚠️ **THE MANA-VALUE FORM WAS ON THIS LIST AND IS NOT ANY MORE (D139), and
     * the order is the point.** D138 refused it because `TargetSpec` had no field
     * for a numeric restriction, so accepting the sentence would have let the
     * spell reanimate ANYTHING. D139 gave the spec that field and made
     * `targetAllowed` check it — so the wording became safe to admit, and only
     * then was it admitted. Enforce first, widen second; the other way round is
     * how a card that reads correctly runs incorrectly.
     */
    expect(
      parseEffects(
        'Return target creature card with mana value 3 or less from your graveyard to the battlefield.',
        'X',
        true,
      ).mode,
    ).toBe('auto');
    // …and the two that ARE the whole sentence still are.
    expect(parseEffects('Return target creature card from your graveyard to your hand.', 'X', true).mode).toBe('auto');
    expect(parseEffects('Return target creature card from your graveyard to the battlefield.', 'X', true).mode).toBe('auto');
  });
});
