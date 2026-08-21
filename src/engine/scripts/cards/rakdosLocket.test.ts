// `Rakdos Locket` — four hybrid pips, paid all-black, buy two cards.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAKDOS_LOCKET_SCRIPT } from './rakdosLocket';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function locketed(): { g: Game; locket: string; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [['Rakdos Locket'], []],
    scripts: createRegistry([RAKDOS_LOCKET_SCRIPT]),
  });
  const locket = put(g, 'p1', 'Rakdos Locket');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: locket, abilityIndex: 1 }));
  settle(g);
  const drew = g.log
    .slice(logAt)
    .flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves : []))
    .filter((m) => m.from.kind === 'library' && m.to.kind === 'hand').length;
  return { g, locket, drew };
}

describe('Rakdos Locket', () => {
  test('pays itself in all-black hybrid and draws two', () => {
    const { g, locket, drew } = locketed();
    expect(g.state.cards[locket]?.zone.kind).toBe('graveyard');
    expect(drew).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = locketed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
