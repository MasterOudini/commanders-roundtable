// `Ravenous Baloth` — a Beast in, four life out; it may eat ITSELF, and
// a non-Beast is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAVENOUS_BALOTH_SCRIPT } from './ravenousBaloth';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fed(): { g: Game; baloth: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Ravenous Baloth', 'Grizzly Bears'], []],
    scripts: createRegistry([RAVENOUS_BALOTH_SCRIPT]),
  });
  const baloth = put(g, 'p1', 'Ravenous Baloth');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, baloth, bears };
}

describe('Ravenous Baloth', () => {
  test('a Bears is not a Beast; the Baloth eats ITSELF for 4 (CR 113.7a)', () => {
    const { g, baloth, bears } = fed();
    const wrong = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: baloth,
      abilityIndex: 0,
      sacrifice: bears,
    });
    expect(wrong.ok).toBe(false);
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: baloth, abilityIndex: 0, sacrifice: baloth }),
    );
    settle(g);
    expect(g.state.cards[baloth]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const { g, baloth } = fed();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: baloth, abilityIndex: 0, sacrifice: baloth }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
