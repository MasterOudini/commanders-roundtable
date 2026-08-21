// `Structural Distortion` — the artifact is EXILED (not destroyed, so an
// indestructible one goes too) and its controller takes 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STRUCTURAL_DISTORTION_SCRIPT } from './structuralDistortion';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function distorted(name: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Structural Distortion'], [name]],
    scripts: createRegistry([STRUCTURAL_DISTORTION_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Structural Distortion', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Structural Distortion', () => {
  test('an artifact is exiled and its controller takes 2', () => {
    const { g, victim } = distorted('Sol Ring');
    expect(g.state.cards[victim]?.zone.kind).toBe('exile');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('a LAND is a legal target too — the probed compound', () => {
    const { g, victim } = distorted('Swamp');
    expect(g.state.cards[victim]?.zone.kind).toBe('exile');
  });

  test('replays to the same hash', () => {
    const { g } = distorted('Sol Ring');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
