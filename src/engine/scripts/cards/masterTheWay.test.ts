// `Master the Way` — the draw lands first, so the count includes it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MASTER_THE_WAY_SCRIPT } from './masterTheWay';
import { MASTER_THE_WAY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mastered(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Master the Way'], []],
    scripts: createRegistry([MASTER_THE_WAY_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Master the Way', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mid };
}

describe('Master the Way', () => {
  test('draws one, then burns for the hand INCLUDING the drawn card', () => {
    const { g, mid } = mastered();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
    expect(g.state.players['p2']?.life).toBe(40 - (mid + 1));
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MASTER_THE_WAY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MASTER_THE_WAY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MASTER_THE_WAY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = mastered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
