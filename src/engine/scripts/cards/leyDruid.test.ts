// `Ley Druid` — the Juniper text on its own id: the tap straightens a
// chosen tapped land.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LEY_DRUID_SCRIPT } from './leyDruid';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DRUID = 'Ley Druid';
const FOREST = 'Forest';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answered(): { g: Game; forest: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DRUID, FOREST], []],
    scripts: createRegistry([LEY_DRUID_SCRIPT]),
  });
  const druid = put(g, 'p1', DRUID);
  const forest = put(g, 'p1', FOREST);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [forest], tapped: true }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: druid, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: forest }] }));
  settle(g);
  return { g, forest };
}

describe('Ley Druid', () => {
  test('the tap untaps the chosen land', () => {
    const { g, forest } = answered();
    expect(g.state.cards[forest]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = answered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
