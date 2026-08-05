// Registered replacement effects — the API that had never run. See D134.
//
// ⚠️ `applyReplacements` fetched `scripts.replacements()`, checked whether the
// list was empty, and then returned `events` UNCHANGED EITHER WAY. A registered
// `ReplacementDef` had never fired, in any game, since M3. D130 and D131 both
// named it while measuring something else; it is `TriggerDef.optional`'s shape
// exactly (D128) — a seam nothing consumed, invisible because nothing raised it.
//
// ⚠️ Driven with `Hardened Scales` and `Branching Evolution`, which replace the
// `CountersChanged` D130 built. They are the textbook CR 616 pair: two counters
// become SIX one way round and FIVE the other, so the order is not a detail —
// and `Hardened Scales` is the card that proves the recursion guard, because its
// own output matches its own condition.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registry';
import {
  BRANCHING_EVOLUTION_SCRIPT as EVOLUTION,
  HARDENED_SCALES_SCRIPT as SCALES,
} from './testing/cardScripts';
import { must, ORACLE, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { InstanceId } from './types/ids';

const DECK = ['Hardened Scales', 'Branching Evolution', 'Grizzly Bears', 'Forest'];

/**
 * Put the named permanents down, then add counters — answering CR 616's ordering
 * prompt with `first` if it comes up.
 *
 * ⚠️ `first` is the printed TEXT of the ability to apply first, not a card name,
 * because that is what the prompt offers: two copies of one card are
 * indistinguishable by name and the key is an instance id.
 */
function countersAfter(
  order: readonly string[],
  scripts: CardScript[],
  delta = 1,
  first?: string,
): number {
  const game = startedGame({ players: 2, decks: [DECK, DECK], scripts: createRegistry(scripts) });
  const bears = put(game, 'p1', 'Grizzly Bears');
  for (const name of order) put(game, 'p1', name);
  must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta }));
  answerOrdering(game, first);
  return game.state.cards[bears]?.counters['+1/+1'] ?? 0;
}

/** Answer every CR 616 prompt the fold raises, preferring `first` when given. */
function answerOrdering(game: ReturnType<typeof startedGame>, first?: string): void {
  for (let guard = 0; guard < 10; guard++) {
    const a = game.state.priority.awaiting;
    if (a?.kind !== 'chooseReplacement') return;
    // ⚠️ MATCHED ON THE ABILITY'S PRINTED TEXT, because that is what the prompt
    // offers — and `Hardened Scales` does not contain its own NAME in its own
    // text, which is exactly how the first cut of this test silently fell back
    // to battlefield order and asserted the answer it was built to replace.
    const wanted =
      first === undefined ? undefined : a.options.find((o: { label: string }) => o.label.includes(first));
    const pick = wanted ?? a.options[0];
    if (!pick) throw new Error('a chooseReplacement prompt with no options');
    must(game.submit({ t: 'AnswerChooseReplacement', player: a.player, key: pick.key }));
  }
  throw new Error('the ordering prompt never cleared');
}

describe('registered replacement effects (CR 614)', () => {
  test('a registered replacement RUNS — which it never did before', () => {
    expect(countersAfter(['Hardened Scales'], [SCALES])).toBe(2);
  });

  test('with none registered, the same board leaves the event alone', () => {
    expect(countersAfter(['Hardened Scales'], [])).toBe(1);
  });

  /**
   * ⚠️ THE RECURSION GUARD, AND IT IS ALSO CR 614.5. `Hardened Scales`'s own
   * output — a `CountersChanged` putting +1/+1 counters on a creature you
   * control — matches its own condition exactly. Without "an effect applies at
   * most once to a given event" this does not return a wrong number; it does not
   * return. The API's own comment asked for this guard and could not enforce it.
   */
  test('a replacement does not re-fire on its own output', () => {
    expect(countersAfter(['Hardened Scales'], [SCALES], 3)).toBe(4);
  });

  /**
   * ⚠️ **THE CR 616 CASE, AND THE ORDER IS BATTLEFIELD ORDER RATHER THAN THE
   * PLAYER'S CHOICE.** Two counters: Scales first (+1 → 3) then doubled → 6;
   * Evolution first (×2 → 4) then +1 → 5. CR 616.1 says the affected object's
   * controller picks; that is a PROMPT and it is NOT built (D134), so this
   * applies them in the order the permanents entered — deterministic and
   * replayable, and not the rule. A card whose correctness depends on choosing
   * stays unregistered, which costs nothing while `NO_SCRIPTS` ships.
   */
  /**
   * ⚠️ **THESE TWO CHANGED SIDES IN D148**, the way `Dig Through Time` did in
   * D142 and `Hymn to Tourach` in D147. They used to assert BATTLEFIELD ORDER —
   * the deterministic fallback D134 shipped while saying plainly that it was not
   * the rule. CR 616.1 makes it the affected object's controller's choice, so the
   * board no longer decides it and the ANSWER does.
   *
   * ⚠️ Both outcomes are still reachable, and that is the whole assertion: six
   * counters one way, five the other, from the same board. If the choice did not
   * matter there would be nothing to build.
   */
  test('the PLAYER chooses which applies first, and it changes the result', () => {
    const board = ['Hardened Scales', 'Branching Evolution'];
    expect(countersAfter(board, [SCALES, EVOLUTION], 2, 'plus one')).toBe(6);
    expect(countersAfter(board, [SCALES, EVOLUTION], 2, 'twice')).toBe(5);
  });

  test('and the board order no longer decides it', () => {
    // The same answer from the opposite battlefield order — which is exactly
    // what the two tests this replaced could not distinguish.
    const flipped = ['Branching Evolution', 'Hardened Scales'];
    expect(countersAfter(flipped, [SCALES, EVOLUTION], 2, 'plus one')).toBe(6);
  });

  /**
   * ⚠️ REGISTRATION ORDER MUST NOT DECIDE IT — the same defect D129 found in
   * layer 6, where the defs loop sat outside the battlefield loop. Both
   * registries here hold the same two scripts in opposite orders and the answer
   * comes from the board.
   */
  test('and the registry’s own order does not change the answer', () => {
    expect(countersAfter(['Hardened Scales', 'Branching Evolution'], [EVOLUTION, SCALES], 2, 'plus one')).toBe(6);
  });

  test('it only replaces its controller’s counters', () => {
    const game = startedGame({
      players: 2,
      decks: [DECK, DECK],
      scripts: createRegistry([SCALES]),
    });
    put(game, 'p1', 'Hardened Scales');
    const theirs: InstanceId = put(game, 'p2', 'Grizzly Bears');
    must(game.submit({ t: 'ManualSetCounter', player: 'p2', card: theirs, kind: '+1/+1', delta: 1 }));
    expect(game.state.cards[theirs]?.counters['+1/+1']).toBe(1);
  });

  test('a replaced event still replays to the same hash', () => {
    const game = startedGame({
      players: 2,
      decks: [DECK, DECK],
      scripts: createRegistry([SCALES, EVOLUTION]),
    });
    const bears = put(game, 'p1', 'Grizzly Bears');
    put(game, 'p1', 'Hardened Scales');
    put(game, 'p1', 'Branching Evolution');
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '+1/+1', delta: 2 }));
    expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
  });

  test('the two fixtures still say what this test thinks they say', () => {
    expect(ORACLE.byName('Hardened Scales')?.faces[0]?.oracleText).toBe(
      'If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead.',
    );
    expect(ORACLE.byName('Branching Evolution')?.faces[0]?.oracleText).toBe(
      'If one or more +1/+1 counters would be put on a creature you control, twice that many +1/+1 counters are put on that creature instead.',
    );
  });
});
