// `Punish Ignorance` — the counter lands with both riders.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PUNISH_IGNORANCE_SCRIPT } from './punishIgnorance';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function punished(): { g: Game; bears: string } {
  const g = startedGame({
    players: 2,
    decks: [['Punish Ignorance'], ['Grizzly Bears']],
    scripts: createRegistry([PUNISH_IGNORANCE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const counter = put(g, 'p1', 'Punish Ignorance', 'hand');
  const bears = put(g, 'p2', 'Grizzly Bears', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  for (const sym of ['W', 'U', 'U', 'B'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 1 }));
  }
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: counter,
      targets: [{ kind: 'stack', id: g.state.stack[g.state.stack.length - 1]?.id as string }],
    }),
  );
  settle(g);
  return { g, bears };
}

describe('Punish Ignorance', () => {
  test('counters the spell, drains 3, gains 3', () => {
    const { g, bears } = punished();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('replays to the same hash', () => {
    const { g } = punished();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
