// `Fevered Convulsions` — the -1/-1 counter lands, twice, with the
// enchantment still there.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FEVERED_CONVULSIONS_SCRIPT } from './feveredConvulsions';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CONVULSIONS = 'Fevered Convulsions';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; convulsions: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CONVULSIONS, BEARS], []],
    scripts: createRegistry([FEVERED_CONVULSIONS_SCRIPT]),
  });
  const convulsions = put(g, 'p1', CONVULSIONS);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, convulsions, bears };
}

describe('Fevered Convulsions', () => {
  test('two activations put two -1/-1 counters, and the SBA kills the 2/2', () => {
    const { g, convulsions, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: convulsions, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['-1/-1']).toBe(1);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: convulsions, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[convulsions]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, convulsions, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: convulsions, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
