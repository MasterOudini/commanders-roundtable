// `Inspired Insurgent` — {1} and its own body pay for the destroy, through
// the staged chain.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { INSPIRED_INSURGENT_SCRIPT } from './inspiredInsurgent';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const INSURGENT = 'Inspired Insurgent';
const ARCHIVE = 'Hedron Archive';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function destroyed(): { g: Game; insurgent: InstanceId; archive: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[INSURGENT, ARCHIVE], []],
    scripts: createRegistry([INSPIRED_INSURGENT_SCRIPT]),
  });
  const insurgent = put(g, 'p1', INSURGENT);
  const archive = put(g, 'p1', ARCHIVE);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: insurgent, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: archive }] }));
  settle(g);
  return { g, insurgent, archive };
}

describe('Inspired Insurgent', () => {
  test('paying {1} and itself destroys the chosen artifact', () => {
    const { g, insurgent, archive } = destroyed();
    expect(g.state.cards[insurgent]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[archive]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = destroyed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
