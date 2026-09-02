// `Drogskol Cavalry` — the Cavalry's own entry is nothing, a non-Spirit is
// nothing, and the activation makes a flying Spirit that is itself "another
// Spirit entering": a token AND 2 life per activation.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DROGSKOL_CAVALRY_SCRIPT } from './drogskolCavalry';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CAVALRY = 'Drogskol Cavalry';
const BEARS = 'Grizzly Bears';
const SPIRIT = TOKEN_TABLE['Spirit|1/1|W|Creature|flying'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spiritsOf(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === SPIRIT?.printingId;
  }).length;
}

function mounted(): { g: Game; cavalry: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [[CAVALRY, CAVALRY, BEARS], []],
    scripts: createRegistry([DROGSKOL_CAVALRY_SCRIPT]),
  });
  settle(g);
  const life0 = g.state.players['p1']?.life ?? 0;
  const cavalry = put(g, 'p1', CAVALRY);
  settle(g);
  return { g, cavalry, life0 };
}

describe('Drogskol Cavalry', () => {
  test('its own entry is nothing ("another")', () => {
    const { g, life0 } = mounted();
    expect(g.state.players['p1']?.life).toBe(life0);
  });

  test('a second Cavalry — another Spirit — is 2 life; a non-Spirit is nothing', () => {
    const { g, life0 } = mounted();
    put(g, 'p1', CAVALRY);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(life0 + 2);
    put(g, 'p1', BEARS);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(life0 + 2);
  });

  test('{3}{W}: a flying Spirit token, and its entry is 2 life', () => {
    const { g, cavalry, life0 } = mounted();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cavalry, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(spiritsOf(g, 'p1')).toBe(1);
    expect(g.state.players['p1']?.life).toBe(life0 + 2);
  });

  test('replays to the same hash', () => {
    const { g, cavalry } = mounted();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cavalry, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
