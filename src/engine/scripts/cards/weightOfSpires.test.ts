// `Weight of Spires` — the count is the TARGET'S controller's nonbasic lands,
// not mine. The two seats get DIFFERENT land counts so the two readings
// cannot both pass.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WEIGHT_OF_SPIRES_SCRIPT } from './weightOfSpires';
import { WEIGHT_OF_SPIRES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Weight of Spires';
const TITAN = 'Grave Titan'; // 6/6 — survives, so the amount is readable
const NONBASIC = 'Darksteel Citadel'; // an artifact LAND, and nonbasic
const BASIC = 'Island'; // must NOT count

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** p2 gets TWO nonbasics plus a basic; p1 gets FOUR nonbasics. Expect 2. */
function cast(): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, NONBASIC, NONBASIC, NONBASIC, NONBASIC],
      [TITAN, NONBASIC, NONBASIC, BASIC],
    ],
    scripts: createRegistry([WEIGHT_OF_SPIRES_SCRIPT]),
  });
  const victim = put(g, 'p2', TITAN);
  put(g, 'p2', NONBASIC);
  put(g, 'p2', NONBASIC);
  put(g, 'p2', BASIC);
  for (let i = 0; i < 4; i += 1) put(g, 'p1', NONBASIC);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Weight of Spires', () => {
  test("the amount is the TARGET controller's nonbasics — 2, not my 4", () => {
    const { g, victim } = cast();
    expect(g.state.cards[victim]?.damage).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WEIGHT_OF_SPIRES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WEIGHT_OF_SPIRES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WEIGHT_OF_SPIRES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
