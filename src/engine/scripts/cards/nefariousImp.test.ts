// `Nefarious Imp` — my permanent leaving asks a scry; the opponent's
// leaving pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NEFARIOUS_IMP_SCRIPT } from './nefariousImp';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function imped(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Nefarious Imp', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([NEFARIOUS_IMP_SCRIPT]),
  });
  put(g, 'p1', 'Nefarious Imp');
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  return { g, mine, theirs };
}

describe('Nefarious Imp', () => {
  test("my Bears leaving asks a scry; the opponent's leaving pays nothing", () => {
    const { g, mine, theirs } = imped();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p2',
        card: theirs,
        to: { kind: 'graveyard', player: 'p2' },
      }),
    );
    settle(g);
    expect(g.state.priority.awaiting?.kind).not.toBe('scryChoice');
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: mine,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(false);
    advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
    settle(g);
  });

  test('replays to the same hash', () => {
    const { g, mine } = imped();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: mine,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
