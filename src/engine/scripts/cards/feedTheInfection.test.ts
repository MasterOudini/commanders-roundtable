// `Feed the Infection` — three cards and 3 life for me either way; the
// Corrupted rider bites only an opponent with three or more poison counters.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FEED_THE_INFECTION_SCRIPT } from './feedTheInfection';
import { FEED_THE_INFECTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Feed the Infection';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/**
 * Cards drawn, counted by MOVE: a multi-card draw is ONE CardsMoved event
 * carrying every card (drawEvents batches), so counting events reads 1.
 */
function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function cast(poison: number): { g: Game; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([FEED_THE_INFECTION_SCRIPT]),
  });
  settle(g);
  if (poison > 0) must(g.submit({ t: 'ManualSetPoison', player: 'p1', target: 'p2', delta: poison }));
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, logAt };
}

describe('Feed the Infection', () => {
  test('no poison: I draw three and lose 3, the opponent is untouched', () => {
    const { g, logAt } = cast(0);
    expect(drawsFor(g, 'p1', logAt)).toBe(3);
    expect(g.state.players['p1']?.life).toBe(37);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('two poison counters are not Corrupted', () => {
    const { g } = cast(2);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('three poison counters: the opponent loses 3 as well', () => {
    const { g } = cast(3);
    expect(g.state.players['p2']?.poison).toBe(3);
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FEED_THE_INFECTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FEED_THE_INFECTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FEED_THE_INFECTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(3);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
