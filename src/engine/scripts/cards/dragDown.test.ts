// `Drag Down` — two basic land types make it -2/-2, which kills the 2/2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DRAG_DOWN_SCRIPT } from './dragDown';
import { DRAG_DOWN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dragged(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Drag Down', 'Swamp', 'Mountain'], ['Grizzly Bears']],
    scripts: createRegistry([DRAG_DOWN_SCRIPT]),
  });
  put(g, 'p1', 'Swamp');
  put(g, 'p1', 'Mountain');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Drag Down', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Drag Down', () => {
  test('a Swamp and a Mountain make it -2/-2 — the 2/2 dies', () => {
    const { g, bears } = dragged();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DRAG_DOWN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DRAG_DOWN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DRAG_DOWN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = dragged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
