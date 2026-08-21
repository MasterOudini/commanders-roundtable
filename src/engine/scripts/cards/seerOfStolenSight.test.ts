// `Seer of Stolen Sight` — my artifact dying asks the surveil; my land
// dying asks nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEER_OF_STOLEN_SIGHT_SCRIPT } from './seerOfStolenSight';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function seered(): { g: Game; ring: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Seer of Stolen Sight', 'Sol Ring', 'Mountain'], []],
    scripts: createRegistry([SEER_OF_STOLEN_SIGHT_SCRIPT]),
  });
  put(g, 'p1', 'Seer of Stolen Sight');
  const ring = put(g, 'p1', 'Sol Ring');
  const land = put(g, 'p1', 'Mountain');
  settle(g);
  holdEverywhere(g);
  return { g, ring, land };
}

describe('Seer of Stolen Sight', () => {
  test('a land dying asks nothing; my artifact dying asks the surveil', () => {
    const { g, ring, land } = seered();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: land,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: ring,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 60_000);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(true);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
  });

  test('replays to the same hash', () => {
    const { g, ring } = seered();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: ring,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 60_000);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
