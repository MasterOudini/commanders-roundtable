// `Stench of Decay` — the nonartifact 1/1 dies; the artifact creature is
// exempt and stands whatever its printed body.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STENCH_OF_DECAY_SCRIPT } from './stenchOfDecay';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stenched(): { g: Game; flesh: InstanceId; metal: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Stench of Decay'], ['Aysen Bureaucrats', 'Skyscanner']],
    scripts: createRegistry([STENCH_OF_DECAY_SCRIPT]),
  });
  const flesh = put(g, 'p2', 'Aysen Bureaucrats');
  const metal = put(g, 'p2', 'Skyscanner');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Stench of Decay', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, flesh, metal };
}

describe('Stench of Decay', () => {
  test('the nonartifact 1/1 dies; the artifact creature stands', () => {
    const { g, flesh, metal } = stenched();
    expect(g.state.cards[flesh]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[metal]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = stenched();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
