// `Flame Burst` — two dead copies make X = 4 at the face.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FLAME_BURST_SCRIPT } from './flameBurst';
import { FLAME_BURST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function burst(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Flame Burst', 'Flame Burst', 'Flame Burst'], ['Grizzly Bears']],
    scripts: createRegistry([FLAME_BURST_SCRIPT]),
  });
  const a = put(g, 'p1', 'Flame Burst', 'graveyard');
  const b = put(g, 'p1', 'Flame Burst', 'graveyard');
  expect(b).not.toBe(a);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Flame Burst', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Flame Burst', () => {
  test('two dead copies make X = 4 at the face', () => {
    const { g } = burst();
    expect(g.state.players['p2']?.life).toBe(36);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FLAME_BURST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FLAME_BURST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FLAME_BURST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = burst();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
