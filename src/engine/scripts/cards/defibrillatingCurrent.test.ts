// `Defibrillating Current` — 4 kills the 2/2 and the caster gains 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEFIBRILLATING_CURRENT_SCRIPT } from './defibrillatingCurrent';
import { DEFIBRILLATING_CURRENT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shocked(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Defibrillating Current'], ['Grizzly Bears']],
    scripts: createRegistry([DEFIBRILLATING_CURRENT_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Defibrillating Current', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Defibrillating Current', () => {
  test('4 damage kills the 2/2; the caster gains 2', () => {
    const { g, bears } = shocked();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEFIBRILLATING_CURRENT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEFIBRILLATING_CURRENT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEFIBRILLATING_CURRENT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = shocked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
