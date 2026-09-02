// `Creeping Chill` — cast, it chills; milled from the library it ASKS, and
// accepting exiles it and chills again, declining leaves it lying there; a
// discard from the hand asks nothing ("from your library").
//
// ⚠️ This file MEASURES two engine firsts (D274): a script trigger with
// `optional: true`, and a watcher active in the GRAVEYARD zone. If either
// door is shut the card is refused, not patched around.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CREEPING_CHILL_SCRIPT } from './creepingChill';
import { CREEPING_CHILL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CHILL = 'Creeping Chill';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fresh(): Game {
  const g = startedGame({
    players: 2,
    decks: [[CHILL], []],
    scripts: createRegistry([CREEPING_CHILL_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return g;
}

function cast(): Game {
  const g = fresh();
  const spell = put(g, 'p1', CHILL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

/**
 * The card milled: library -> graveyard, with the prompt (if any) reached.
 * put() cannot place a card in a library, so it goes hand -> top of library
 * first; the move that matters is the second one.
 */
function milled(): { g: Game; chill: InstanceId } {
  const g = fresh();
  const chill = put(g, 'p1', CHILL, 'hand');
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: chill,
      to: { kind: 'library', player: 'p1' },
      placement: 'top',
    }),
  );
  expect(g.state.cards[chill]?.zone.kind).toBe('library');
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: chill, to: { kind: 'graveyard', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
  return { g, chill };
}

function answer(g: Game, accept: boolean): void {
  const awaiting = g.state.priority.awaiting;
  if (awaiting?.kind !== 'optionalTrigger') throw new Error('expected the optional-trigger prompt');
  must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: awaiting.stackId, accept }));
  settle(g);
}

describe('Creeping Chill', () => {
  test('cast: 3 to the opponent, 3 for me', () => {
    const g = cast();
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('milled and accepted: exiled, 3 to the opponent, 3 for me', () => {
    const { g, chill } = milled();
    expect(g.state.priority.awaiting?.kind).toBe('optionalTrigger');
    answer(g, true);
    expect(g.state.cards[chill]?.zone.kind).toBe('exile');
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(43);
    expect(g.log.some((e) => e.body.t === 'OptionalTriggerAnswered' && e.body.accept)).toBe(true);
  });

  test('milled and declined: it stays in the graveyard and nothing happens', () => {
    const { g, chill } = milled();
    answer(g, false);
    expect(g.state.cards[chill]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(40);
    expect(g.state.players['p1']?.life).toBe(40);
    expect(g.log.some((e) => e.body.t === 'DamageDealt')).toBe(false);
  });

  test('discarded from the hand: no question at all ("from your library")', () => {
    const g = fresh();
    const chill = put(g, 'p1', CHILL, 'hand');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: chill, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[chill]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'OptionalTriggerAnswered')).toBe(false);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CREEPING_CHILL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CREEPING_CHILL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CREEPING_CHILL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = milled();
    answer(g, true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
