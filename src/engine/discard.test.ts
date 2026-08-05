// CR 701.8 — discarding, and CR 701.8a's "the player chooses". See D137.
//
// ⚠️ THE SEVENTH BUCKET SPLIT DECIDED THIS SHAPE. `chooseFromZone` is 1,625
// cards by reach, and its one regex is five alternatives that are five different
// things: discard (801 cards), return-from-graveyard (675), look-at-top-N (154),
// return-from-a-graveyard (9), and search-library — which matches ZERO, because
// `effect:search` is checked first and shadows it entirely.
//
// ⚠️ AND DISCARD SPLIT AGAIN, by what the clause IS: an additional cost (25), a
// keyword cost (18), a trigger payload (239), an activated payload (265), a mode
// of a modal spell (44), and a plain one-shot EFFECT (221, of which 135 are
// blocked on nothing else). Only the last is a spell that can resolve by itself.

import { describe, expect, test } from 'vitest';
import { Game } from './game';
import { replay, stateHash } from './log';
import { advanceUntil, findAnywhere, fullControl, must, ORACLE, put, startedGame } from './testing/harness';
import { effectEvents } from './effects';
import { faceOf } from './oracle';

const LANDS = ['Swamp', 'Swamp', 'Swamp'];
const DECK = ['Mind Rot', 'Mental Vapors', 'Hymn to Tourach', 'Duress', ...LANDS, 'Forest', 'Plains'];

function game(): Game {
  const g = startedGame({ players: 2, decks: [DECK, DECK] });
  fullControl(g, 'p1');
  for (const l of LANDS) put(g, 'p1', l);
  return g;
}

function asking(g: Game): Extract<NonNullable<Game['state']['priority']['awaiting']>, { kind: 'chooseFromZone' }> {
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'chooseFromZone') throw new Error(`expected chooseFromZone, got ${a?.kind ?? 'none'}`);
  return a;
}

/** Cast the spell at a player for real, and let it resolve. */
function castAt(g: Game, name: string, target: 'p1' | 'p2'): void {
  const card = findAnywhere(g, 'p1', name);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'hand', player: 'p1' } }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'player', id: target }] }));
  // ⚠️ Stops at the PROMPT as well as at an empty stack: the discard question is
  // raised as the spell finishes resolving, and a predicate that only watched
  // the stack would spin past it to the end of the turn.
  advanceUntil(g, (s) => s.stack.length === 0 || s.priority.awaiting?.kind === 'chooseFromZone', 400);
}

describe('discard as an effect (CR 701.8)', () => {
  test('the sentence is read, and the whole card now runs', () => {
    const face = ORACLE.byName('Mind Rot')?.faces[0];
    expect(face?.oracleText).toBe('Target player discards two cards.');
    expect(face?.effectMode).toBe('auto');
    expect(face?.effects).toHaveLength(1);
    expect(face?.effects[0]).toMatchObject({ kind: 'discard', amount: 2 });
  });

  /** One card, so the singular of the pattern is exercised by a real printing. */
  test('…and at one card too', () => {
    const face = ORACLE.byName('Mental Vapors')?.faces[0];
    expect(face?.effects[0]).toMatchObject({ kind: 'discard', amount: 1 });
  });

  /**
   * ⚠️ **`Hymn to Tourach` CHANGED SIDES IN D147**, the way `Dig Through Time`
   * did in D142. D137 pinned it as the wording that must be REFUSED, and the
   * reason it gave was not "this is unreadable" but "`effectEvents` has no RNG,
   * and randomness in this engine comes only from the seeded generator threaded
   * through the log". D147 gave `effectEvents` an RNG, so the refusal expired
   * with its reason.
   *
   * ⚠️ The distinction it was protecting is still enforced, one rule along: this
   * takes the cards ITSELF and raises no prompt, where `Mind Rot` asks. That is
   * asserted below rather than left to the `effectMode`.
   */
  test('“at random” resolves by itself now, and asks nobody', () => {
    const face = ORACLE.byName('Hymn to Tourach')?.faces[0];
    expect(face?.oracleText).toBe('Target player discards two cards at random.');
    expect(face?.effectMode).toBe('auto');
    expect(face?.effects[0]?.atRandom).toBe(true);
  });

  test('and the CHOSEN wording still is not random', () => {
    // The pair, so neither can quietly become the other.
    expect(ORACLE.byName('Mind Rot')?.faces[0]?.effects[0]?.atRandom).toBe(false);
  });

  /**
   * ⚠️ **AND SO IS THE ONE WHERE THE CASTER PICKS.** 53 lines (Duress,
   * Thoughtseize, Coercion) reveal a hand and let the CASTER choose from it —
   * a different chooser, a different prompt, and a hand that has to be made
   * public first.
   */
  test('the caster-picks wording is refused', () => {
    const face = ORACLE.byName('Duress')?.faces[0];
    expect(face?.oracleText).toContain('You choose a noncreature, nonland card from it');
    expect(face?.effectMode).not.toBe('auto');
  });
});

describe('choosing which cards to discard (CR 701.8a)', () => {
  test('a hand bigger than the count RAISES the prompt and moves nothing yet', () => {
    const g = game();
    const before = [...(g.state.zones.hand['p2'] ?? [])];
    expect(before.length).toBeGreaterThan(2);
    castAt(g, 'Mind Rot', 'p2');

    const a = asking(g);
    expect(a).toMatchObject({ player: 'p2', zone: 'hand', count: 2, label: 'Mind Rot' });
    expect(g.state.zones.hand['p2']).toEqual(before);
  });

  /**
   * ⚠️ **THE PROMPT CARRIES NO CARD IDS, and that is the whole design.** A hand
   * is hidden and `Awaiting` crosses the wire WHOLE (D61), so listing the
   * candidates here would post one player's hand to every client the moment they
   * were asked to discard. The client computes them from its own `PlayerView`.
   */
  test('the prompt does not carry the hand', () => {
    const g = game();
    castAt(g, 'Mind Rot', 'p2');
    const a = asking(g);
    const json = JSON.stringify(a);
    for (const id of g.state.zones.hand['p2'] ?? []) expect(json).not.toContain(id);
    /**
     * ⚠️ **THE FIELD LIST IS PINNED, and D141 is why that is worth doing.** This
     * failed the moment `rest` was added, which is the check working: every new
     * field on a prompt over a hidden zone has to be looked at before it ships.
     * `rest` is an enum naming a DESTINATION (`'graveyard' | 'bottom' | null`) —
     * it says nothing about which cards are there, so it cannot leak. A field
     * that carried ids would fail the loop above instead.
     */
    expect(Object.keys(a).sort()).toEqual(['count', 'kind', 'label', 'player', 'rest', 'zone']);
  });

  test('answering moves exactly those cards to the graveyard', () => {
    const g = game();
    castAt(g, 'Mind Rot', 'p2');
    const hand = [...(g.state.zones.hand['p2'] ?? [])];
    const picked = [hand[0]!, hand[2]!];
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: picked }));

    expect(g.state.priority.awaiting).toBeNull();
    for (const id of picked) {
      expect(g.state.zones.graveyard['p2']).toContain(id);
      expect(g.state.zones.hand['p2']).not.toContain(id);
    }
    expect(g.state.zones.hand['p2']).toHaveLength(hand.length - 2);
  });

  /**
   * ⚠️ THE PROMPT VOUCHES FOR NOTHING, so the handler is the whole legality
   * check — four ways to get it wrong and each is its own rejection.
   */
  test('a wrong answer is rejected, four ways', () => {
    const g = game();
    castAt(g, 'Mind Rot', 'p2');
    const hand = [...(g.state.zones.hand['p2'] ?? [])];
    const mine = g.state.zones.hand['p1'] ?? [];

    // Too few.
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [hand[0]!] }).ok).toBe(false);
    // ⚠️ A DUPLICATE. `[c1, c1]` has length 2 and is one card, so a length check
    // alone would let a player discard half of what they owe.
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [hand[0]!, hand[0]!] }).ok).toBe(false);
    // Somebody else's hand — which a client cannot see, so cannot have picked.
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [hand[0]!, mine[0]!] }).ok).toBe(false);
    // The wrong player answering.
    expect(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [mine[0]!, mine[1]!] }).ok).toBe(false);
    // …and the prompt is still up, unharmed.
    expect(asking(g).count).toBe(2);
  });

  /**
   * ⚠️ **NO PROMPT WHEN THERE IS NOTHING TO CHOOSE** (CR 701.8a). A hand no
   * bigger than the count goes to the graveyard whole — a question with one legal
   * answer is a click that teaches the player nothing.
   */
  test('a hand no bigger than the count is discarded whole, unasked', () => {
    const g = game();
    const hand = [...(g.state.zones.hand['p2'] ?? [])];
    // Down to exactly two cards.
    for (const id of hand.slice(2)) {
      must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: id, to: { kind: 'library', player: 'p2' } }));
    }
    expect(g.state.zones.hand['p2']).toHaveLength(2);

    castAt(g, 'Mind Rot', 'p2');
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.zones.hand['p2']).toHaveLength(0);
    expect(g.state.zones.graveyard['p2']).toEqual(expect.arrayContaining(hand.slice(0, 2)));
  });

  test('an empty hand discards nothing and asks nothing', () => {
    const g = game();
    for (const id of [...(g.state.zones.hand['p2'] ?? [])]) {
      must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: id, to: { kind: 'library', player: 'p2' } }));
    }
    const gy = (g.state.zones.graveyard['p2'] ?? []).length;
    castAt(g, 'Mind Rot', 'p2');
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.zones.graveyard['p2']).toHaveLength(gy);
  });

  /**
   * ⚠️ **A CLAUSE WITH NO TARGET SAYS SO NOW, and this is the line that would
   * have saved D137's investigation four hours.** CR 608.2b counters a spell on
   * resolution only when EVERY target is illegal; a spell that keeps one still
   * resolves, and its dead clauses are skipped. For a milestone that skip was a
   * bare `continue`, so the log read "Mind Rot resolves." and nothing else —
   * indistinguishable from a broken effect.
   *
   * ⚠️ **DRIVEN AT `effectEvents`, BECAUSE D139 CLOSED THE WAY IN.** The
   * original version cast Mind Rot with an empty target list, which the host
   * accepted: `prepareCast` took the list and used it only for the ward
   * surcharge, so an inline-targets cast skipped `validateTargets` entirely.
   * That is now rejected `illegalTarget` — a strictly better state, and it
   * leaves this branch reachable only from a spell that LOST a target between
   * cast and resolution while keeping another. No fixture has two target clauses
   * and an `auto` effect, so the seam is driven directly rather than pretended
   * at through a cast that can no longer happen.
   */
  test('a clause whose target is missing is skipped OUT LOUD', () => {
    const g = game();
    const face = faceOf(ORACLE.byName('Mind Rot')!, 0);
    const events = effectEvents(
      g.state,
      g.deps,
      {
        id: 's1',
        kind: 'spell',
        faceIndex: 0,
        controller: 'p1',
        card: null,
        source: null,
        abilityRef: null,
        // The clause points at index 0 of an EMPTY list — a target that is gone.
        targets: [],
        modes: [],
        xValue: null,
        label: 'Mind Rot',
        identity: [],
        taxApplied: 0,
        isCommanderCast: false,
        castFrom: { kind: 'hand', player: 'p1' },
      },
      face.effects,
    );

    // Nothing was discarded — correct, there was nobody to discard.
    expect(events.some((e) => e.t === 'AwaitingSet')).toBe(false);
    // …and it SAYS why, rather than resolving silently into nothing.
    const said = events.some(
      (e) => e.t === 'Narrated' && e.text.includes('no legal target left') && e.text.includes('Mind Rot'),
    );
    expect(said).toBe(true);
  });

  /**
   * ⚠️ AND THE HOLE THAT TEST USED TO GO THROUGH IS SHUT (D139). The host is the
   * only authority on target legality, and a `CastSpell` that named its own
   * targets was taken at its word.
   */
  test('a cast that names no target for a clause that needs one is rejected', () => {
    const g = game();
    const card = findAnywhere(g, 'p1', 'Mind Rot');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'hand', player: 'p1' } }));
    const r = g.submit({ t: 'CastSpell', player: 'p1', card, targets: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('illegalTarget');
  });

  test('the discard is on the log, and the game replays', () => {
    const g = game();
    castAt(g, 'Mind Rot', 'p2');
    const hand = [...(g.state.zones.hand['p2'] ?? [])];
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [hand[0]!, hand[1]!] }));
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});


// ── discarding AT RANDOM (D147) ──────────────────────────────────────────────
describe('a random discard', () => {
  test('takes the cards itself, from the seeded generator', () => {
    const g = game();
    const before = (g.state.zones.hand['p2'] ?? []).length;
    castAt(g, 'Hymn to Tourach', 'p2');
    // ⚠️ NO PROMPT. That is the whole difference from `Mind Rot`, and the
    // distinction D137's refusal was protecting.
    expect(g.state.priority.awaiting?.kind).not.toBe('chooseFromZone');
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before - 2);
    expect((g.state.zones.graveyard['p2'] ?? []).length).toBe(2);
  });

  /**
   * ⚠️ **THE ONE THAT MATTERS.** Randomness that is not recorded as an
   * `rngAfter` replays to a DIFFERENT board than it was played on — silently,
   * and only for the cards that use it. `reducer.ts` takes `state.rng` from the
   * event rather than re-running the generator, so this is the assertion that
   * the advance was threaded all the way out of `effectResult`.
   */
  test('and the draw is on the log, so the game still replays', () => {
    const g = game();
    castAt(g, 'Hymn to Tourach', 'p2');
    expect(g.log.some((e) => e.rngAfter !== undefined)).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
