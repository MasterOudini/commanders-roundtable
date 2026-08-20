// `Drag to the Bottom` — a Swamp and a Mountain make X = 3; the 2/2 dies
// everywhere and the surviving 6/6 reads exactly 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DRAG_TO_THE_BOTTOM_SCRIPT } from './dragToTheBottom';
import { DRAG_TO_THE_BOTTOM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bottomed(): { g: Game; bears: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Drag to the Bottom', 'Swamp', 'Mountain'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([DRAG_TO_THE_BOTTOM_SCRIPT]),
  });
  put(g, 'p1', 'Swamp');
  put(g, 'p1', 'Mountain');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Drag to the Bottom', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, maw };
}

describe('Drag to the Bottom', () => {
  test('X = 1 + two basic types: the 2/2 dies, the 6/6 reads 3', () => {
    const { g, bears, maw } = bottomed();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DRAG_TO_THE_BOTTOM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DRAG_TO_THE_BOTTOM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DRAG_TO_THE_BOTTOM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = bottomed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
