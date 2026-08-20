// `Channel the Suns` — one of each color into the pool.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CHANNEL_THE_SUNS_SCRIPT } from './channelTheSuns';
import { CHANNEL_THE_SUNS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function channeled(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Channel the Suns'], ['Grizzly Bears']],
    scripts: createRegistry([CHANNEL_THE_SUNS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Channel the Suns', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Channel the Suns', () => {
  test('WUBRG lands in the pool', () => {
    const g = channeled();
    const pool = g.state.players['p1']?.pool;
    expect(pool?.W).toBe(1);
    expect(pool?.U).toBe(1);
    expect(pool?.B).toBe(1);
    expect(pool?.R).toBe(1);
    expect(pool?.G).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CHANNEL_THE_SUNS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CHANNEL_THE_SUNS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CHANNEL_THE_SUNS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = channeled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
