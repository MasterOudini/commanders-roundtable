// `Arms of Hadar` — -2/-2 across ONE player's whole board: the target's 2/2
// dies through the SBA, their 6/6 shrinks, and MY creature is untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ARMS_OF_HADAR_SCRIPT } from './armsOfHadar';
import { ARMS_OF_HADAR } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; bears: InstanceId; maw: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Arms of Hadar', 'Grizzly Bears'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([ARMS_OF_HADAR_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  const mine = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Arms of Hadar', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, bears, maw, mine };
}

describe('Arms of Hadar', () => {
  test("the target's 2/2 dies, their 6/6 is a 4/4, MY creature is untouched", () => {
    const { g, bears, maw, mine } = cast();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, maw).power).toBe(4);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, mine).power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ARMS_OF_HADAR.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ARMS_OF_HADAR.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ARMS_OF_HADAR.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
