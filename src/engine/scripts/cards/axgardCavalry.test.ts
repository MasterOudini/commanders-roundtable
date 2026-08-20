// `Axgard Cavalry` — Akki Drillmaster's {T}-grant on its own id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { AXGARD_CAVALRY_SCRIPT } from './axgardCavalry';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Axgard Cavalry', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([AXGARD_CAVALRY_SCRIPT]),
  });
  const cavalry = put(g, 'p1', 'Axgard Cavalry');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    60_000,
  );
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cavalry, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Axgard Cavalry', () => {
  test('the tap buys derived haste for the turn', () => {
    const { g, bears } = granted();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('haste')).toBe(true);
  });

  test('cleanup takes it back', () => {
    const { g, bears } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('haste')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
