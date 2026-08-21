// `Psychic Barrier` — a creature spell dies and its caster pays 1; a
// sorcery is not a legal target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PSYCHIC_BARRIER_SCRIPT } from './psychicBarrier';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function countered(): { g: Game; bears: string } {
  const g = startedGame({
    players: 2,
    decks: [['Psychic Barrier'], ['Grizzly Bears']],
    scripts: createRegistry([PSYCHIC_BARRIER_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const barrier = put(g, 'p1', 'Psychic Barrier', 'hand');
  const bears = put(g, 'p2', 'Grizzly Bears', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: barrier,
      targets: [{ kind: 'stack', id: g.state.stack[g.state.stack.length - 1]?.id as string }],
    }),
  );
  settle(g);
  return { g, bears };
}

describe('Psychic Barrier', () => {
  test('the creature spell is countered and its caster loses 1', () => {
    const { g, bears } = countered();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g } = countered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
