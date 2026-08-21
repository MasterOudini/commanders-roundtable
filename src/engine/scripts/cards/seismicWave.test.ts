// `Seismic Wave` — 2 to the first target, 1 to the opponent's nonartifact
// board.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEISMIC_WAVE_SCRIPT } from './seismicWave';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function waved(): { g: Game; small: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Seismic Wave'],
      ['Aysen Bureaucrats', 'Aysen Bureaucrats'],
    ],
    scripts: createRegistry([SEISMIC_WAVE_SCRIPT]),
  });
  const small = put(g, 'p2', 'Aysen Bureaucrats');
  const other = put(g, 'p2', 'Aysen Bureaucrats');
  expect(small).not.toBe(other);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Seismic Wave', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: small },
        { kind: 'player', id: 'p2' },
      ],
    }),
  );
  settle(g);
  return { g, small, other };
}

describe('Seismic Wave', () => {
  test('the first target takes 2 and dies; the fan kills the other 1/1', () => {
    const { g, small, other } = waved();
    expect(g.state.cards[small]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[other]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = waved();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
