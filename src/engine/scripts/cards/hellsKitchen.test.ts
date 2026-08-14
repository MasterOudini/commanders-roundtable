// `Hell's Kitchen` — both printed rules on entry: tapped (D134's built-in)
// and the life (the def).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HELLS_KITCHEN_SCRIPT } from './hellsKitchen';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const KITCHEN = "Hell's Kitchen";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; kitchen: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[KITCHEN], []],
    scripts: createRegistry([HELLS_KITCHEN_SCRIPT]),
  });
  const kitchen = put(g, 'p1', KITCHEN, 'hand');
  must(g.submit({ t: 'PlayLand', player: 'p1', card: kitchen }));
  settle(g);
  return { g, kitchen };
}

describe("Hell's Kitchen", () => {
  test('enters tapped AND pays 1 life — both printed rules', () => {
    const { g, kitchen } = entered();
    expect(g.state.cards[kitchen]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[kitchen]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
