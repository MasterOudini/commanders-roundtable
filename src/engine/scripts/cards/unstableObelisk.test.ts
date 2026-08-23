// `Unstable Obelisk` — Universal Solvent's ability at #a1, because a MANA
// line counts as ability 0.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UNSTABLE_OBELISK_SCRIPT } from './unstableObelisk';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const OBELISK = 'Unstable Obelisk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fired(): { g: Game; obelisk: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[OBELISK], [BEARS]],
    scripts: createRegistry([UNSTABLE_OBELISK_SCRIPT]),
  });
  const obelisk = put(g, 'p1', OBELISK);
  const victim = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 7 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: obelisk, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, obelisk, victim };
}

describe('Unstable Obelisk', () => {
  test('#a1 destroys the permanent and eats the Obelisk', () => {
    const { g, obelisk, victim } = fired();
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[obelisk]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = fired();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
