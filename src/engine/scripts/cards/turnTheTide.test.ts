// `Turn the Tide` — the one-side debuff: theirs shrink, mine do not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TURN_THE_TIDE_SCRIPT } from './turnTheTide';
import { TURN_THE_TIDE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Turn the Tide';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function turned(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], [BEARS]],
    scripts: createRegistry([TURN_THE_TIDE_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs };
}

describe('Turn the Tide', () => {
  test("only the OPPONENT's creature shrinks, and toughness is untouched", () => {
    const { g, mine, theirs } = turned();
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).power).toBe(0);
    expect(derive(g.state, ORACLE, g.deps.scripts, theirs).toughness).toBe(2);
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TURN_THE_TIDE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TURN_THE_TIDE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TURN_THE_TIDE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = turned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
