// `Strip Mine` — the land eats itself to kill a land.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STRIP_MINE_SCRIPT } from './stripMine';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mined(): { g: Game; mine: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Strip Mine'], ['Swamp']],
    scripts: createRegistry([STRIP_MINE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Strip Mine');
  const victim = put(g, 'p2', 'Swamp');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mine, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, mine, victim };
}

describe('Strip Mine', () => {
  test('both lands end in graveyards', () => {
    const { g, mine, victim } = mined();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = mined();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
