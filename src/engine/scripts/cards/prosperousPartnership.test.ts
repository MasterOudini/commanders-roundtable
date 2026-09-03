// `Prosperous Partnership` — two Citizens on entry; the two Citizens and a
// bear tap for a Treasure.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PROSPEROUS_PARTNERSHIP_SCRIPT } from './prosperousPartnership';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PARTNERSHIP = 'Prosperous Partnership';
const BEARS = 'Grizzly Bears';
const CITIZEN = TOKEN_TABLE['Citizen|1/1|GW|Creature|'];
const TREASURE = TOKEN_TABLE['Treasure|/||Artifact|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokensOf(g: Game, player: string, printingId: string | undefined): InstanceId[] {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === printingId;
  });
}

function placed(): { g: Game; partnership: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PARTNERSHIP, BEARS], []],
    scripts: createRegistry([PROSPEROUS_PARTNERSHIP_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const partnership = put(g, 'p1', PARTNERSHIP);
  settle(g);
  return { g, partnership, bears };
}

describe('Prosperous Partnership', () => {
  test('entering makes two Citizens', () => {
    const { g } = placed();
    expect(tokensOf(g, 'p1', CITIZEN?.printingId).length).toBe(2);
  });

  test('the two Citizens and the bear tap for a Treasure', () => {
    const { g, partnership, bears } = placed();
    const citizens = tokensOf(g, 'p1', CITIZEN?.printingId);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: partnership, abilityIndex: 0, tap: [...citizens, bears], targets: [] }));
    settle(g);
    expect(tokensOf(g, 'p1', TREASURE?.printingId).length).toBe(1);
    for (const id of [...citizens, bears]) expect(g.state.cards[id]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, partnership, bears } = placed();
    const citizens = tokensOf(g, 'p1', CITIZEN?.printingId);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: partnership, abilityIndex: 0, tap: [...citizens, bears], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
