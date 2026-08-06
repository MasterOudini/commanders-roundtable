// `Cephalid Scout` — the land predicate with no tap and no target: the
// second freed card D168 lands unchanged.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CEPHALID_SCOUT_SCRIPT } from './cephalidScout';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SCOUT = 'Cephalid Scout';
const FOUNTAIN = 'Radiant Fountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; scout: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SCOUT, FOUNTAIN], []],
    scripts: createRegistry([CEPHALID_SCOUT_SCRIPT]),
  });
  const scout = put(g, 'p1', SCOUT);
  const land = put(g, 'p1', FOUNTAIN);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, scout, land };
}

describe('Cephalid Scout', () => {
  test('the land pays and the draw arrives — no tap anywhere in the cost', () => {
    const { g, scout, land } = game();
    const handBefore = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: scout, abilityIndex: 0, sacrifice: land }));
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(handBefore + 1);
    expect(g.state.cards[scout]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, scout, land } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: scout, abilityIndex: 0, sacrifice: land }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
