// `Shadowy Backstreet` — enters tapped and asks the surveil.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHADOWY_BACKSTREET_SCRIPT } from './shadowyBackstreet';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function backstreeted(): { g: Game; land: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Shadowy Backstreet'], []],
    scripts: createRegistry([SHADOWY_BACKSTREET_SCRIPT]),
  });
  holdEverywhere(g);
  const land = put(g, 'p1', 'Shadowy Backstreet');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 60_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, land, revealed };
}

describe('Shadowy Backstreet', () => {
  test('enters tapped and the surveil asks', () => {
    const { g, land, revealed } = backstreeted();
    expect(g.state.cards[land]?.tapped).toBe(true);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(true);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    advanceUntil(g, (s) => (s.priority.awaiting ?? null) === null, 20_000);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = backstreeted();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
