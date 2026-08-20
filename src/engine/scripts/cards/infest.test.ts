// `Infest` — -2/-2 across the board: the 2/2s die, the 6/6 reads 4/4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INFEST_SCRIPT } from './infest';
import { INFEST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function infested(): { g: Game; bears: InstanceId; big: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Infest'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([INFEST_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const big = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Infest', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, big };
}

describe('Infest', () => {
  test('the 2/2 dies to -2/-2; the 6/6 reads 4/4', () => {
    const { g, bears, big } = infested();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, big).power).toBe(4);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INFEST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INFEST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INFEST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = infested();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
