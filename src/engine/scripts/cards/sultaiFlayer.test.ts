// `Sultai Flayer` — a toughness-4 death pays 4; a 2/2's death pays
// nothing, and an opponent's big creature pays nothing either.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SULTAI_FLAYER_SCRIPT } from './sultaiFlayer';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId, PlayerId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kill(g: Game, player: PlayerId, card: InstanceId): void {
  must(
    g.submit({
      t: 'ManualMoveCard',
      player,
      card,
      to: { kind: 'graveyard', player },
    }),
  );
  settle(g);
}

function flayed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Sultai Flayer', 'Grave Titan', 'Grizzly Bears'], ['Grave Titan']],
    scripts: createRegistry([SULTAI_FLAYER_SCRIPT]),
  });
  put(g, 'p1', 'Sultai Flayer');
  const big = put(g, 'p1', 'Grave Titan');
  const small = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grave Titan');
  settle(g);
  holdEverywhere(g);
  // My 2/2 dying pays nothing.
  kill(g, 'p1', small);
  if ((g.state.players['p1']?.life ?? 0) !== 40) throw new Error('a 2/2 death must pay nothing');
  // An OPPONENT'S big creature dying pays nothing.
  kill(g, 'p2', theirs);
  if ((g.state.players['p1']?.life ?? 0) !== 40) {
    throw new Error("an opponent's death must pay nothing");
  }
  // MY toughness-4-or-greater creature dying pays 4.
  kill(g, 'p1', big);
  return g;
}

describe('Sultai Flayer', () => {
  test('only my own tough creature pays the 4', () => {
    const g = flayed();
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const g = flayed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
