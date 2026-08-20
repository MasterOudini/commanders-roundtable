// `Last Breath` — the 1/1 is exiled and its controller banks 4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LAST_BREATH_SCRIPT } from './lastBreath';
import { LAST_BREATH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function breathed(): { g: Game; herder: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Last Breath'], ['Elvish Herder']],
    scripts: createRegistry([LAST_BREATH_SCRIPT]),
  });
  const herder = put(g, 'p2', 'Elvish Herder');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Last Breath', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: herder }] }));
  settle(g);
  return { g, herder };
}

describe('Last Breath', () => {
  test('the 1/1 is exiled and its controller gains 4', () => {
    const { g, herder } = breathed();
    expect(g.state.cards[herder]?.zone.kind).toBe('exile');
    expect(g.state.players['p2']?.life).toBe(44);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LAST_BREATH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LAST_BREATH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LAST_BREATH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = breathed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
