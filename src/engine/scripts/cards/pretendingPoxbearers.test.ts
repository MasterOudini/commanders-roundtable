// `Pretending Poxbearers` — dying leaves an Ally behind.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRETENDING_POXBEARERS_SCRIPT } from './pretendingPoxbearers';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function poxed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Pretending Poxbearers'], []],
    scripts: createRegistry([PRETENDING_POXBEARERS_SCRIPT]),
  });
  const pox = put(g, 'p1', 'Pretending Poxbearers');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: pox, to: { kind: 'graveyard', player: 'p1' } }));
  settle(g);
  return g;
}

describe('Pretending Poxbearers', () => {
  test('dying mints a 1/1 white Ally', () => {
    const g = poxed();
    const allies = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Ally');
    expect(allies).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = poxed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
