// `Dimir Informant` — the entry reveals TWO and asks; both may go to the
// graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DIMIR_INFORMANT_SCRIPT } from './dimirInformant';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function informed(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Dimir Informant', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([DIMIR_INFORMANT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  put(g, 'p1', 'Dimir Informant');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Dimir Informant', () => {
  test('the entry reveals TWO; both may fall to the graveyard', () => {
    const { g, revealed } = informed();
    expect(revealed).toHaveLength(2);
    const grave = (g.state.zones.graveyard['p1'] ?? []).length;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(grave + 2);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = informed();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
