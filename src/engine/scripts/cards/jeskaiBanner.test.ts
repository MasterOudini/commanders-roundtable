// `Jeskai Banner` — {U}{R}{W}, the tap and itself draw a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JESKAI_BANNER_SCRIPT } from './jeskaiBanner';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BANNER = 'Jeskai Banner';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; banner: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BANNER], []],
    scripts: createRegistry([JESKAI_BANNER_SCRIPT]),
  });
  const banner = put(g, 'p1', BANNER);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return { g, banner };
}

describe('Jeskai Banner', () => {
  test('paying {U}{R}{W}, the tap and itself draws a card', () => {
    const { g, banner } = board();
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: banner, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[banner]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g, banner } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: banner, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
