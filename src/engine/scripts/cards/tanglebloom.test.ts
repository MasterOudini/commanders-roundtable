// `Tanglebloom` — the repeatable {1}, {T} gain. An ARTIFACT taps the turn it
// arrives (CR 302.6 is about creatures), so this needs no turn-3 wait — but
// the tap is real, so the second activation of one turn is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TANGLEBLOOM_SCRIPT } from './tanglebloom';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BLOOM = 'Tanglebloom';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; bloom: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BLOOM], []],
    scripts: createRegistry([TANGLEBLOOM_SCRIPT]),
  });
  const bloom = put(g, 'p1', BLOOM);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, bloom };
}

describe('Tanglebloom', () => {
  test('paying {1} and tapping gains 1 life', () => {
    const { g, bloom } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bloom, abilityIndex: 0 }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(41);
    expect(g.state.cards[bloom]?.tapped).toBe(true);
  });

  test('a second activation the same turn is refused — the {T} is real', () => {
    const { g, bloom } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bloom, abilityIndex: 0 }));
    settle(g);
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: bloom, abilityIndex: 0 });
    expect(r.ok).toBe(false);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g, bloom } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bloom, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
