// `Spectral Sailor` — the no-tap draw works twice in one turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPECTRAL_SAILOR_SCRIPT } from './spectralSailor';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sailed(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Spectral Sailor'], []],
    scripts: createRegistry([SPECTRAL_SAILOR_SCRIPT]),
  });
  const sailor = put(g, 'p1', 'Spectral Sailor');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 8 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sailor, abilityIndex: 0 }));
  settle(g);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sailor, abilityIndex: 0 }));
  settle(g);
  return { g, before };
}

describe('Spectral Sailor', () => {
  test('two activations, two draws, no tap anywhere', () => {
    const { g, before } = sailed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 2);
  });

  test('replays to the same hash', () => {
    const { g } = sailed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
