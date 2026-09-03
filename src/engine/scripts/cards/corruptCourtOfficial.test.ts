// `Corrupt Court Official` — its entry aims at an opponent, who chooses a
// card of their hand to discard; I am refused as the target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CORRUPT_COURT_OFFICIAL_SCRIPT } from './corruptCourtOfficial';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const OFFICIAL = 'Corrupt Court Official';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function landed(): Game {
  const g = startedGame({
    players: 2,
    decks: [[OFFICIAL], []],
    scripts: createRegistry([CORRUPT_COURT_OFFICIAL_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', OFFICIAL);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return g;
}

describe('Corrupt Court Official', () => {
  test('the opponent chooses a card of their hand to discard', () => {
    const g = landed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const hand = idsIn(g, 'p2', 'hand');
    const chosen = hand[0] as string;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [chosen] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(idsIn(g, 'p2', 'hand').length).toBe(hand.length - 1);
  });

  test('I am refused as the target ("target opponent")', () => {
    const g = landed();
    const res = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const g = landed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const hand = idsIn(g, 'p2', 'hand');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [hand[0] as string] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
