// `Contraband Kingpin` — both arms of "an artifact you control enters":
// a CARD artifact asks, a TOKEN artifact asks, a CREATURE entering does
// not, and THEIR artifact does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CONTRABAND_KINGPIN_SCRIPT } from './contrabandKingpin';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Contraband Kingpin', 'Sol Ring', 'Grizzly Bears'], ['Sol Ring']],
    scripts: createRegistry([CONTRABAND_KINGPIN_SCRIPT]),
  });
  put(g, 'p1', 'Contraband Kingpin');
  settle(g);
  return g;
}

function answerScry(g: Game): void {
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) as InstanceId[];
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
  settle(g);
}

describe('Contraband Kingpin', () => {
  test('MY card artifact entering asks; my creature and THEIR artifact do not', () => {
    const g = board();
    put(g, 'p1', 'Sol Ring');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    answerScry(g);
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    put(g, 'p2', 'Sol Ring');
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('a TOKEN artifact fires the second arm (the Tier-3 token tool)', () => {
    const g = board();
    // The manual token tool creates via TokenCreated — the arm's own event.
    const clue = g.deps.oracle.byName?.('Clue');
    const printingId = clue?.printingId ?? '';
    must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId, count: 1 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
    answerScry(g);
  });

  test('replays to the same hash', () => {
    const g = board();
    put(g, 'p1', 'Sol Ring');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    answerScry(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
