// `Gerrard's Command` — untap AND +3/+3 in one resolve; cleanup keeps the
// untap and drops the pump.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GERRARDS_COMMAND_SCRIPT } from './gerrardsCommand';
import { GERRARD_S_COMMAND } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function commanded(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Gerrard's Command", 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([GERRARDS_COMMAND_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
  const spell = put(g, 'p1', "Gerrard's Command", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe("Gerrard's Command", () => {
  test('the tapped 2/2 stands up as a 5/5; cleanup drops only the pump', () => {
    const { g, bears } = commanded();
    expect(g.state.cards[bears]?.tapped).toBe(false);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(5);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GERRARD_S_COMMAND.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GERRARD_S_COMMAND.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GERRARD_S_COMMAND.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = commanded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
