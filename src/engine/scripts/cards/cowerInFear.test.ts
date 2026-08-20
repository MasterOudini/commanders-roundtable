// `Cower in Fear` — -1/-1 across the OPPONENTS' creatures only.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { COWER_IN_FEAR_SCRIPT } from './cowerInFear';
import { COWER_IN_FEAR } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cowered(): { g: Game; theirs: InstanceId; elf: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Cower in Fear', 'Grizzly Bears'], ['Colossal Dreadmaw', 'Llanowar Elves']],
    scripts: createRegistry([COWER_IN_FEAR_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Colossal Dreadmaw');
  const elf = put(g, 'p2', 'Llanowar Elves');
  const mine = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Cower in Fear', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, theirs, elf, mine };
}

describe('Cower in Fear', () => {
  test('their 1/1 dies, their 6/6 shrinks, MINE untouched', () => {
    const { g, theirs, elf, mine } = cowered();
    expect(g.state.cards[elf]?.zone.kind).toBe('graveyard');
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).power).toBe(5);
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = COWER_IN_FEAR.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, COWER_IN_FEAR.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(COWER_IN_FEAR.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cowered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
