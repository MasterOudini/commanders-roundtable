// `Rumbling Sentry` — entering asks the scry.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RUMBLING_SENTRY_SCRIPT } from './rumblingSentry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function sentried(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Rumbling Sentry'], []],
    scripts: createRegistry([RUMBLING_SENTRY_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', 'Rumbling Sentry');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 60_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Rumbling Sentry', () => {
  test('entering asks scry 1 and the answer clears it', () => {
    const { g, revealed } = sentried();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.count).toBe(1);
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(false);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    advanceUntil(g, (s) => (s.priority.awaiting ?? null) === null, 20_000);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = sentried();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
