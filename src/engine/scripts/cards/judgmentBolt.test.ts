// `Judgment Bolt` — 5 at the 6/6 and the Equipment census at its
// controller.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { JUDGMENT_BOLT_SCRIPT } from './judgmentBolt';
import { JUDGMENT_BOLT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function judged(): { g: Game; dreadmaw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Judgment Bolt', 'Lightning Greaves'], ['Colossal Dreadmaw']],
    scripts: createRegistry([JUDGMENT_BOLT_SCRIPT]),
  });
  put(g, 'p1', 'Lightning Greaves');
  const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Judgment Bolt', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dreadmaw }] }));
  settle(g);
  return { g, dreadmaw };
}

describe('Judgment Bolt', () => {
  test('5 marks the 6/6 and one Equipment sends 1 at its controller', () => {
    const { g, dreadmaw } = judged();
    expect(g.state.cards[dreadmaw]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[dreadmaw]?.damage).toBe(5);
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = JUDGMENT_BOLT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, JUDGMENT_BOLT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(JUDGMENT_BOLT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = judged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
