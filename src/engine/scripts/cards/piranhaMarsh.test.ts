// `Piranha Marsh` — enters tapped, and the entry bites a targeted player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PIRANHA_MARSH_SCRIPT } from './piranhaMarsh';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function marshed(): { g: Game; marsh: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Piranha Marsh'], []],
    scripts: createRegistry([PIRANHA_MARSH_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const marsh = put(g, 'p1', 'Piranha Marsh');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, marsh };
}

describe('Piranha Marsh', () => {
  test('enters TAPPED and the target loses 1', () => {
    const { g, marsh } = marshed();
    expect(g.state.cards[marsh]?.tapped).toBe(true);
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g } = marshed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
