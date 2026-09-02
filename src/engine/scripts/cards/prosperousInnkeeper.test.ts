// `Prosperous Innkeeper` — a Treasure on its own entry (and no life for
// itself); another creature entering is 1 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PROSPEROUS_INNKEEPER_SCRIPT } from './prosperousInnkeeper';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const INNKEEPER = 'Prosperous Innkeeper';
const BEARS = 'Grizzly Bears';
const TREASURE = TOKEN_TABLE['Treasure|/||Artifact|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function treasuresOf(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === TREASURE?.printingId;
  }).length;
}

function opened(): { g: Game; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [[INNKEEPER, BEARS], []],
    scripts: createRegistry([PROSPEROUS_INNKEEPER_SCRIPT]),
  });
  settle(g);
  const life0 = g.state.players['p1']?.life ?? 0;
  put(g, 'p1', INNKEEPER);
  settle(g);
  return { g, life0 };
}

describe('Prosperous Innkeeper', () => {
  test('its own entry is a Treasure and no life', () => {
    const { g, life0 } = opened();
    expect(treasuresOf(g, 'p1')).toBe(1);
    expect(g.state.players['p1']?.life).toBe(life0);
  });

  test('another creature entering is 1 life', () => {
    const { g, life0 } = opened();
    put(g, 'p1', BEARS);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(life0 + 1);
    expect(treasuresOf(g, 'p1')).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = opened();
    put(g, 'p1', BEARS);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
