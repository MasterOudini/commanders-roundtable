// `Desert Sandstorm` — 1 to each creature: the 1/1 dies, the 2/2 stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DESERT_SANDSTORM_SCRIPT } from './desertSandstorm';
import { DESERT_SANDSTORM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sanded(): { g: Game; strix: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Desert Sandstorm'], ['Baleful Strix', 'Grizzly Bears']],
    scripts: createRegistry([DESERT_SANDSTORM_SCRIPT]),
  });
  const strix = put(g, 'p2', 'Baleful Strix');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Desert Sandstorm', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, strix, bears };
}

describe('Desert Sandstorm', () => {
  test('the 1/1 dies to a single point; the 2/2 stands', () => {
    const { g, strix, bears } = sanded();
    expect(g.state.cards[strix]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(40);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DESERT_SANDSTORM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DESERT_SANDSTORM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DESERT_SANDSTORM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = sanded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
