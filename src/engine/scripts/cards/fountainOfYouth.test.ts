// `Fountain of Youth` — a life at a time, twice in one turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FOUNTAIN_OF_YOUTH_SCRIPT } from './fountainOfYouth';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FOUNTAIN = 'Fountain of Youth';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; fountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FOUNTAIN], []],
    scripts: createRegistry([FOUNTAIN_OF_YOUTH_SCRIPT]),
  });
  const fountain = put(g, 'p1', FOUNTAIN);
  settle(g);
  return { g, fountain };
}

describe('Fountain of Youth', () => {
  test('one activation gains 1; untapped by the wrench, it goes again', () => {
    const { g, fountain } = game();
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: fountain, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 1);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [fountain], tapped: false }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: fountain, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 2);
  });

  test('replays to the same hash', () => {
    const { g, fountain } = game();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: fountain, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
