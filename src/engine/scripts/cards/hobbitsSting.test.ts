// `Hobbit's Sting` — two creatures and a Food token make X = 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HOBBITS_STING_SCRIPT } from './hobbitsSting';
import { HOBBIT_S_STING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stung(): { g: Game; dreadmaw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Hobbit's Sting", 'Grizzly Bears', 'Elvish Herder'], ['Colossal Dreadmaw']],
    scripts: createRegistry([HOBBITS_STING_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Elvish Herder');
  const food = g.deps.oracle.byName?.('Food');
  must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: food?.printingId ?? '', count: 1 }));
  const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Hobbit's Sting", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dreadmaw }] }));
  settle(g);
  return { g, dreadmaw };
}

describe("Hobbit's Sting", () => {
  test('two creatures plus one Food mark 3 on the 6/6', () => {
    const { g, dreadmaw } = stung();
    expect(g.state.cards[dreadmaw]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[dreadmaw]?.damage).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HOBBIT_S_STING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HOBBIT_S_STING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HOBBIT_S_STING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = stung();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
