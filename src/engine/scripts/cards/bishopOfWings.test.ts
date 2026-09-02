// `Bishop of Wings` — an Angel of mine entering is 4 life; the same Angel
// dying is a 1/1 flying Spirit; a non-Angel entering is nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BISHOP_OF_WINGS_SCRIPT } from './bishopOfWings';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BISHOP = 'Bishop of Wings';
const ANGEL = 'Dazzling Angel'; // Creature — Angel
const BEARS = 'Grizzly Bears';
const SPIRIT = TOKEN_TABLE['Spirit|1/1|W|Creature|flying'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blessed(): { g: Game; bishop: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [[BISHOP, ANGEL, BEARS], []],
    scripts: createRegistry([BISHOP_OF_WINGS_SCRIPT]),
  });
  const bishop = put(g, 'p1', BISHOP);
  settle(g);
  const life0 = g.state.players['p1']?.life ?? 0;
  return { g, bishop, life0 };
}

function spiritsOf(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === SPIRIT?.printingId;
  }).length;
}

describe('Bishop of Wings', () => {
  test('an Angel entering under my control is 4 life', () => {
    const { g, life0 } = blessed();
    put(g, 'p1', ANGEL);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(life0 + 4);
  });

  test('a non-Angel entering is nothing', () => {
    const { g, life0 } = blessed();
    put(g, 'p1', BEARS);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(life0);
  });

  test('my Angel dying is a 1/1 flying Spirit', () => {
    const { g } = blessed();
    const angel = put(g, 'p1', ANGEL);
    settle(g);
    expect(spiritsOf(g, 'p1')).toBe(0);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: angel, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[angel]?.zone.kind).toBe('graveyard');
    expect(spiritsOf(g, 'p1')).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = blessed();
    const angel = put(g, 'p1', ANGEL);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: angel, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
