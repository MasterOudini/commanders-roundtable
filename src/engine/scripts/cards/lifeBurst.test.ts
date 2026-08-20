// `Life Burst` — 4 plus 4 per buried namesake: one in each graveyard
// makes 12.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LIFE_BURST_SCRIPT } from './lifeBurst';
import { LIFE_BURST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function burst(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Life Burst', 'Life Burst'], ['Life Burst']],
    scripts: createRegistry([LIFE_BURST_SCRIPT]),
  });
  put(g, 'p1', 'Life Burst', 'graveyard');
  put(g, 'p2', 'Life Burst', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Life Burst', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] }));
  settle(g);
  return { g };
}

describe('Life Burst', () => {
  test('4 base plus 4 per namesake in EACH graveyard: 12', () => {
    const { g } = burst();
    expect(g.state.players['p1']?.life).toBe(52);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LIFE_BURST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LIFE_BURST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LIFE_BURST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = burst();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
