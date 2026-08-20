// `Bewildering Blizzard` — three draws plus -3/-0 across the OPPONENTS'
// creatures only.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BEWILDERING_BLIZZARD_SCRIPT } from './bewilderingBlizzard';
import { BEWILDERING_BLIZZARD } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; theirs: InstanceId; mine: InstanceId; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Bewildering Blizzard', 'Grizzly Bears'], ['Colossal Dreadmaw']],
    scripts: createRegistry([BEWILDERING_BLIZZARD_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Colossal Dreadmaw');
  const mine = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Bewildering Blizzard', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, theirs, mine, before };
}

describe('Bewildering Blizzard', () => {
  test('three cards drawn; their 6/6 reads 3/6; my 2/2 untouched', () => {
    const { g, theirs, mine, before } = cast();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 3);
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).power).toBe(3);
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).toughness).toBe(6);
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BEWILDERING_BLIZZARD.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BEWILDERING_BLIZZARD.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BEWILDERING_BLIZZARD.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
