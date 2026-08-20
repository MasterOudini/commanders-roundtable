// `Faerie Seer` — the entry reveals TWO and asks; both may go to the
// bottom.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FAERIE_SEER_SCRIPT } from './faerieSeer';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function seen(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Faerie Seer', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([FAERIE_SEER_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  put(g, 'p1', 'Faerie Seer');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Faerie Seer', () => {
  test('the entry reveals TWO; bottoming both keeps them in the library', () => {
    const { g, revealed } = seen();
    expect(revealed).toHaveLength(2);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    for (const id of revealed) expect(g.state.cards[id]?.zone.kind).toBe('library');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = seen();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
