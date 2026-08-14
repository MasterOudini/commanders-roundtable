// `High Market` — a creature and the tap pay for 1 life; a land cannot pay
// the creature predicate.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HIGH_MARKET_SCRIPT } from './highMarket';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MARKET = 'High Market';
const BEARS = 'Grizzly Bears';
const FOUNTAIN = 'Radiant Fountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; market: InstanceId; bears: InstanceId; fountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MARKET, BEARS, FOUNTAIN], []],
    scripts: createRegistry([HIGH_MARKET_SCRIPT]),
  });
  const market = put(g, 'p1', MARKET);
  const bears = put(g, 'p1', BEARS);
  const fountain = put(g, 'p1', FOUNTAIN);
  settle(g);
  return { g, market, bears, fountain };
}

describe('High Market', () => {
  test('the sacrificed creature pays for the life', () => {
    const { g, market, bears } = board();
    const before = g.state.players.p1?.life ?? 0;
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: market, abilityIndex: 1, sacrifice: bears }),
    );
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(before + 1);
  });

  test('a land cannot pay the creature predicate', () => {
    const { g, market, fountain } = board();
    const r = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: market,
      abilityIndex: 1,
      sacrifice: fountain,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, market, bears } = board();
    must(
      g.submit({ t: 'ActivateAbility', player: 'p1', card: market, abilityIndex: 1, sacrifice: bears }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
