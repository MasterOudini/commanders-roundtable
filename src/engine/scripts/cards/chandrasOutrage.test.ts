// `Chandra's Outrage` — 4 to the creature, 2 to its controller.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CHANDRAS_OUTRAGE_SCRIPT } from './chandrasOutrage';
import { CHANDRA_S_OUTRAGE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function outraged(): { g: Game; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Chandra's Outrage"], ['Colossal Dreadmaw']],
    scripts: createRegistry([CHANDRAS_OUTRAGE_SCRIPT]),
  });
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Chandra's Outrage", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
  settle(g);
  return { g, maw };
}

describe("Chandra's Outrage", () => {
  test('4 marked on the creature, 2 off its controller', () => {
    const { g, maw } = outraged();
    expect(g.state.cards[maw]?.damage).toBe(4);
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CHANDRA_S_OUTRAGE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CHANDRA_S_OUTRAGE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CHANDRA_S_OUTRAGE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = outraged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
