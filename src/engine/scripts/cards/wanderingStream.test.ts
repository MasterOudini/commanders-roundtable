// `Wandering Stream` — TYPES, not lands: two Islands are one type.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WANDERING_STREAM_SCRIPT } from './wanderingStream';
import { WANDERING_STREAM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Wandering Stream';
const DECK = [SPELL, 'Island', 'Island', 'Forest', 'Mountain'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(lands: string[], theirs: string[]): Game {
  const g = startedGame({
    players: 2,
    decks: [DECK, ['Swamp', 'Plains']],
    scripts: createRegistry([WANDERING_STREAM_SCRIPT]),
  });
  for (const n of lands) put(g, 'p1', n);
  for (const n of theirs) put(g, 'p2', n);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Wandering Stream', () => {
  test('two Islands are ONE type — 2 life, not 4', () => {
    const g = cast(['Island', 'Island'], []);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('three distinct types pay 6', () => {
    const g = cast(['Island', 'Forest', 'Mountain'], []);
    expect(g.state.players['p1']?.life).toBe(46);
  });

  test("an OPPONENT's basic types do not count", () => {
    const g = cast(['Island'], ['Swamp', 'Plains']);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WANDERING_STREAM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WANDERING_STREAM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WANDERING_STREAM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast(['Island', 'Forest'], []);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
