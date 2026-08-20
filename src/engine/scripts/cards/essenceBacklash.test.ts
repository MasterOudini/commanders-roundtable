// `Essence Backlash` — the held Dreadmaw cast dies and its controller
// takes its printed 6.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ESSENCE_BACKLASH_SCRIPT } from './essenceBacklash';
import { ESSENCE_BACKLASH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function backlashed(): { g: Game; spell: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Essence Backlash'], ['Colossal Dreadmaw']],
    scripts: createRegistry([ESSENCE_BACKLASH_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p2', 'Colossal Dreadmaw', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: spell }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack.find((o) => o.card === spell)?.id as string;
  const counter = put(g, 'p1', 'Essence Backlash', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: counter }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  settle(g);
  return { g, spell };
}

describe('Essence Backlash', () => {
  test('the creature spell dies and its controller takes its printed power', () => {
    const { g, spell } = backlashed();
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(34);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ESSENCE_BACKLASH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ESSENCE_BACKLASH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ESSENCE_BACKLASH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = backlashed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
