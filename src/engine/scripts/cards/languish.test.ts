// `Languish` — -4/-4 clears the small board; the 6/6 reads 2/2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LANGUISH_SCRIPT } from './languish';
import { LANGUISH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function languished(): { g: Game; bears: InstanceId; big: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Languish'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([LANGUISH_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const big = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Languish', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, big };
}

describe('Languish', () => {
  test('the 2/2 dies; the 6/6 reads 2/2', () => {
    const { g, bears, big } = languished();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, big).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LANGUISH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LANGUISH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LANGUISH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = languished();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
