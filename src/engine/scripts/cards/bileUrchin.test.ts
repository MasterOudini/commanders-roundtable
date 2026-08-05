// `Bile Urchin` — a mana-free self-sacrifice draining a targeted player; no
// {T} in the cost, so summoning sickness does not gate it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BILE_URCHIN_SCRIPT } from './bileUrchin';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const URCHIN = 'Bile Urchin';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; urchin: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[URCHIN], []],
    scripts: createRegistry([BILE_URCHIN_SCRIPT]),
  });
  const urchin = put(g, 'p1', URCHIN);
  settle(g);
  return { g, urchin };
}

describe('Bile Urchin', () => {
  test('the targeted player loses 1 life, with the Urchin spent as the cost', () => {
    const { g, urchin } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: urchin,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.players['p1']?.life).toBe(40);
    expect(g.state.cards[urchin]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, urchin } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: urchin,
        abilityIndex: 0,
        targets: [{ kind: 'player', id: 'p2' }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
