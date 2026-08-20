// `Huatli's Final Strike` — the +1 counts: a 2/2 logs 3 on the 6/6.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HUATLIS_FINAL_STRIKE_SCRIPT } from './huatlisFinalStrike';
import { HUATLI_S_FINAL_STRIKE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function struck(): { g: Game; bears: InstanceId; dreadmaw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Huatli's Final Strike", 'Grizzly Bears'], ['Colossal Dreadmaw']],
    scripts: createRegistry([HUATLIS_FINAL_STRIKE_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Huatli's Final Strike", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: bears },
        { kind: 'card', id: dreadmaw },
      ],
    }),
  );
  settle(g);
  return { g, bears, dreadmaw };
}

describe("Huatli's Final Strike", () => {
  test('the pump lands first: the 2/2 reads 3/2 and marks 3 on the 6/6', () => {
    const { g, bears, dreadmaw } = struck();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(3);
    expect(g.state.cards[dreadmaw]?.damage).toBe(3);
    expect(g.state.cards[bears]?.damage).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HUATLI_S_FINAL_STRIKE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HUATLI_S_FINAL_STRIKE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HUATLI_S_FINAL_STRIKE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = struck();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
