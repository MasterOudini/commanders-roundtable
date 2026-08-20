// `Elegant Parlor` — the entry is TAPPED (the built-in) and asks the
// surveil (the def): both halves of the printed card in one game.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELEGANT_PARLOR_SCRIPT } from './elegantParlor';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; parlor: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Elegant Parlor', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([ELEGANT_PARLOR_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const parlor = put(g, 'p1', 'Elegant Parlor');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, parlor, revealed };
}

describe('Elegant Parlor', () => {
  test('enters TAPPED and asks the surveil; binning the one card lands it in the graveyard', () => {
    const { g, parlor, revealed } = entered();
    expect(g.state.cards[parlor]?.tapped).toBe(true);
    expect(revealed).toHaveLength(1);
    const grave = (g.state.zones.graveyard['p1'] ?? []).length;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(grave + 1);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = entered();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
