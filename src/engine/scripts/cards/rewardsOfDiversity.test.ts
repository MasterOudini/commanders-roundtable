// `Rewards of Diversity` — an opponent's multicolored cast pays 4; their
// mono-colored cast pays nothing; my own multicolored cast pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REWARDS_OF_DIVERSITY_SCRIPT } from './rewardsOfDiversity';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { PlayerId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function withRewards(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      ['Rewards of Diversity', 'Lightning Helix'],
      ['Lightning Helix', 'Lightning Bolt'],
    ],
    scripts: createRegistry([REWARDS_OF_DIVERSITY_SCRIPT]),
  });
  put(g, 'p1', 'Rewards of Diversity');
  settle(g);
  holdEverywhere(g);
  return g;
}

/** Cast a burn spell as `who`, aimed at the caster themselves. */
function selfBurn(
  g: Game,
  who: PlayerId,
  name: string,
  symbols: readonly ('W' | 'U' | 'B' | 'R' | 'G' | 'C')[],
): void {
  advanceUntil(g, (s) => s.turn.activePlayer === who && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, who, name, 'hand');
  for (const symbol of symbols) {
    must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol, amount: 1 }));
  }
  must(g.submit({ t: 'CastSpell', player: who, card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: who, targets: [{ kind: 'player', id: who }] }));
  settle(g);
}

describe('Rewards of Diversity', () => {
  test("an opponent's multicolored cast pays 4; mono pays nothing", () => {
    const g = withRewards();
    const before = g.state.players['p1']?.life ?? 0;
    selfBurn(g, 'p2', 'Lightning Helix', ['R', 'W']);
    expect(g.state.players['p1']?.life).toBe(before + 4);
    selfBurn(g, 'p2', 'Lightning Bolt', ['R']);
    expect(g.state.players['p1']?.life).toBe(before + 4);
  });

  test('my own multicolored cast pays nothing', () => {
    const g = withRewards();
    const before = g.state.players['p1']?.life ?? 0;
    selfBurn(g, 'p1', 'Lightning Helix', ['R', 'W']);
    // Helix is unregistered here, so its own resolution moves no life;
    // the only thing that could move p1 is the trigger, and it must not.
    expect(g.state.players['p1']?.life).toBe(before);
  });

  test('replays to the same hash', () => {
    const g = withRewards();
    selfBurn(g, 'p2', 'Lightning Helix', ['R', 'W']);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
