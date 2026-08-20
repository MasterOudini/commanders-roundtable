// `One with the Machine` — the mv-4 Archive beats the mv-1 Ring: draw 4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ONE_WITH_THE_MACHINE_SCRIPT } from './oneWithTheMachine';
import { ONE_WITH_THE_MACHINE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function machined(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['One with the Machine', 'Sol Ring', 'Hedron Archive'], []],
    scripts: createRegistry([ONE_WITH_THE_MACHINE_SCRIPT]),
  });
  put(g, 'p1', 'Sol Ring');
  put(g, 'p1', 'Hedron Archive');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'One with the Machine', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mid };
}

describe('One with the Machine', () => {
  test('draws the greatest mana value — four for the Archive', () => {
    const { g, mid } = machined();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 4);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ONE_WITH_THE_MACHINE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ONE_WITH_THE_MACHINE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ONE_WITH_THE_MACHINE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = machined();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
