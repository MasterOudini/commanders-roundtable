// `Cabal Trainee` — the mana-free self-sacrifice debuff.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CABAL_TRAINEE_SCRIPT } from './cabalTrainee';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TRAINEE = 'Cabal Trainee';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; trainee: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TRAINEE], ['Silvercoat Lion']],
    scripts: createRegistry([CABAL_TRAINEE_SCRIPT]),
  });
  const theirs = put(g, 'p2', 'Silvercoat Lion');
  const trainee = put(g, 'p1', TRAINEE);
  settle(g);
  return { g, trainee, theirs };
}

describe('Cabal Trainee', () => {
  test('the -2/-0 lands with the Trainee spent as the cost', () => {
    const { g, trainee, theirs } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: trainee,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: theirs }],
      }),
    );
    settle(g);
    expect(
      g.log.some(
        (e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === theirs && e.body.power === -2,
      ),
    ).toBe(true);
    expect(g.state.cards[trainee]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, trainee, theirs } = game();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: trainee,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: theirs }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
