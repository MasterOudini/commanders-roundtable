// `Zhalfirin Void` — the scry trigger on an untapped land, proven on its
// own oracle id (the twin rule).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ZHALFIRIN_VOID_SCRIPT } from './zhalfirinVoid';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function played(): { g: Game; land: InstanceId; revealed: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Zhalfirin Void', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([ZHALFIRIN_VOID_SCRIPT]),
  });
  const land = put(g, 'p1', 'Zhalfirin Void');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'))[0] as InstanceId;
  return { g, land, revealed };
}

describe('Zhalfirin Void', () => {
  test('enters UNTAPPED and still asks', () => {
    const { g, land } = played();
    expect(g.state.cards[land]?.tapped).toBe(false);
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
  });

  test('keeping the card leaves the library untouched on top', () => {
    const { g, revealed } = played();
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(revealed);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [revealed], toBottom: [] }));
    settle(g);
    const after = g.state.zones.library['p1'] ?? [];
    expect(after[after.length - 1]).toBe(revealed);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = played();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [revealed] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
