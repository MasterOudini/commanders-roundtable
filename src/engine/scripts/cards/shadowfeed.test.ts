// `Shadowfeed` — the buried card is exiled and the 3 lands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHADOWFEED_SCRIPT } from './shadowfeed';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Shadowfeed'], ['Grizzly Bears']],
    scripts: createRegistry([SHADOWFEED_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Shadowfeed', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Shadowfeed', () => {
  test('the corpse is exiled and the 3 lands', () => {
    const { g, bears } = fed();
    expect(g.state.cards[bears]?.zone.kind).toBe('exile');
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('replays to the same hash', () => {
    const { g } = fed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
