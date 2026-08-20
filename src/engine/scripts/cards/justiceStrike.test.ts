// `Justice Strike` — the 6/6 punches itself to death.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { JUSTICE_STRIKE_SCRIPT } from './justiceStrike';
import { JUSTICE_STRIKE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function struck(): { g: Game; dreadmaw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Justice Strike'], ['Colossal Dreadmaw']],
    scripts: createRegistry([JUSTICE_STRIKE_SCRIPT]),
  });
  const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Justice Strike', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: dreadmaw }] }));
  settle(g);
  return { g, dreadmaw };
}

describe('Justice Strike', () => {
  test('the 6/6 kills itself', () => {
    const { g, dreadmaw } = struck();
    expect(g.state.cards[dreadmaw]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = JUSTICE_STRIKE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, JUSTICE_STRIKE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(JUSTICE_STRIKE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = struck();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
