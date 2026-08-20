// `Akki Drillmaster` — the {T}-cost grant: summoning sickness gates the
// activation (the memory trap: wait for turn 3), then derived haste.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { AKKI_DRILLMASTER_SCRIPT } from './akkiDrillmaster';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Akki Drillmaster', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([AKKI_DRILLMASTER_SCRIPT]),
  });
  const akki = put(g, 'p1', 'Akki Drillmaster');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  // {T} on a creature: summoning sickness holds until it has been under its
  // controller's control since their last upkeep — turn 3 is p1's second.
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    60_000,
  );
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: akki, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Akki Drillmaster', () => {
  test('the tap buys derived haste for the turn', () => {
    const { g, bears } = granted();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('haste')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
