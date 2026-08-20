// `Phyrexian Vivisector` — every controlled creature death asks the
// scry, its own included.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PHYREXIAN_VIVISECTOR_SCRIPT } from './phyrexianVivisector';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answerScry(g: Game): void {
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'))[0] as InstanceId;
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [revealed], toBottom: [] }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
}

describe('Phyrexian Vivisector', () => {
  test('a controlled creature death asks the scry — and so does its own', () => {
    const g = startedGame({
      players: 2,
      decks: [['Phyrexian Vivisector', 'Grizzly Bears'], []],
      scripts: createRegistry([PHYREXIAN_VIVISECTOR_SCRIPT]),
    });
    const vivisector = put(g, 'p1', 'Phyrexian Vivisector');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    answerScry(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: vivisector, to: { kind: 'graveyard', player: 'p1' } }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    answerScry(g);
    settle(g);
    expect(g.state.cards[vivisector]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Phyrexian Vivisector', 'Grizzly Bears'], []],
      scripts: createRegistry([PHYREXIAN_VIVISECTOR_SCRIPT]),
    });
    put(g, 'p1', 'Phyrexian Vivisector');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    answerScry(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
