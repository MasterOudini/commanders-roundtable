// `Rakdos Cluestone` — pays itself for a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAKDOS_CLUESTONE_SCRIPT } from './rakdosCluestone';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function clued(): { g: Game; stone: string; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [['Rakdos Cluestone'], []],
    scripts: createRegistry([RAKDOS_CLUESTONE_SCRIPT]),
  });
  const stone = put(g, 'p1', 'Rakdos Cluestone');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: stone, abilityIndex: 1 }));
  settle(g);
  const drew = g.log
    .slice(logAt)
    .flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves : []))
    .filter((m) => m.from.kind === 'library' && m.to.kind === 'hand').length;
  return { g, stone, drew };
}

describe('Rakdos Cluestone', () => {
  test('pays itself and draws one', () => {
    const { g, stone, drew } = clued();
    expect(g.state.cards[stone]?.zone.kind).toBe('graveyard');
    expect(drew).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = clued();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
