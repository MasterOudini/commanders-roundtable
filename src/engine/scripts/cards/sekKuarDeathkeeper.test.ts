// `Sek'Kuar, Deathkeeper` — a nontoken creature dying pays a Graveborn;
// the Graveborn's own death pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEK_KUAR_DEATHKEEPER_SCRIPT } from './sekKuarDeathkeeper';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): InstanceId[] {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken);
}

function kept(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Sek'Kuar, Deathkeeper", 'Grizzly Bears'], []],
    scripts: createRegistry([SEK_KUAR_DEATHKEEPER_SCRIPT]),
  });
  put(g, 'p1', "Sek'Kuar, Deathkeeper");
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  return { g, bears };
}

describe("Sek'Kuar, Deathkeeper", () => {
  test('a nontoken death pays a Graveborn; the token death pays nothing', () => {
    const { g, bears } = kept();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: bears,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    const born = tokens(g);
    expect(born).toHaveLength(1);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: born[0] as InstanceId,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(tokens(g)).toHaveLength(0);
  });

  test('replays to the same hash', () => {
    const { g, bears } = kept();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: bears,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
