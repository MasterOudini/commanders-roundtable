// `Automatic Librarian` — the ETB scry 2 on its own oracle id, with the
// SHORT-LIBRARY FLOOR proven: a one-card library asks about one card, not two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AUTOMATIC_LIBRARIAN_SCRIPT } from './automaticLibrarian';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Automatic Librarian', () => {
  test('entering reveals two and the answer clears the prompt', () => {
    const g = startedGame({
      players: 2,
      decks: [['Automatic Librarian', 'Grizzly Bears'], ['Grizzly Bears']],
      scripts: createRegistry([AUTOMATIC_LIBRARIAN_SCRIPT]),
    });
    put(g, 'p1', 'Automatic Librarian');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(revealed).toHaveLength(2);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('a ONE-card library floors the count at one', () => {
    const g = startedGame({
      players: 2,
      decks: [['Automatic Librarian', 'Grizzly Bears'], ['Grizzly Bears']],
      scripts: createRegistry([AUTOMATIC_LIBRARIAN_SCRIPT]),
    });
    // Empty the library down to ONE card before the Librarian enters.
    const lib = () => g.state.zones.library['p1'] ?? [];
    while (lib().length > 1) {
      const top = lib()[lib().length - 1] as InstanceId;
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: top, to: { kind: 'exile', player: 'p1' } }));
    }
    put(g, 'p1', 'Automatic Librarian');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.count).toBe(1);
    const only = lib()[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [only], toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Automatic Librarian', 'Grizzly Bears'], ['Grizzly Bears']],
      scripts: createRegistry([AUTOMATIC_LIBRARIAN_SCRIPT]),
    });
    put(g, 'p1', 'Automatic Librarian');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
