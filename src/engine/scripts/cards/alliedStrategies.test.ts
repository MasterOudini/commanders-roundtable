// `Allied Strategies` — Domain: distinct BASIC land types among the TARGET
// player's lands, and the draws are theirs.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ALLIED_STRATEGIES_SCRIPT } from './alliedStrategies';
import { ALLIED_STRATEGIES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; libBefore: number } {
  const g = startedGame({
    players: 2,
    decks: [['Allied Strategies', 'Plains', 'Island', 'Mountain', 'Mountain'], ['Grizzly Bears']],
    scripts: createRegistry([ALLIED_STRATEGIES_SCRIPT]),
  });
  put(g, 'p1', 'Plains');
  put(g, 'p1', 'Island');
  put(g, 'p1', 'Mountain');
  put(g, 'p1', 'Mountain');
  settle(g);
  const spell = put(g, 'p1', 'Allied Strategies', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  const libBefore = g.state.zones.library['p1']?.length ?? 0;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] }));
  settle(g);
  return { g, libBefore };
}

describe('Allied Strategies', () => {
  test('three basic types among four lands draw exactly three', () => {
    const { g, libBefore } = cast();
    expect(g.state.zones.library['p1']?.length).toBe(libBefore - 3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ALLIED_STRATEGIES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ALLIED_STRATEGIES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ALLIED_STRATEGIES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
