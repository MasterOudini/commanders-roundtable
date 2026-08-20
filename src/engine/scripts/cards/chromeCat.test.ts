// `Chrome Cat` — the ETB scry 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CHROME_CAT_SCRIPT } from './chromeCat';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function played(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Chrome Cat', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([CHROME_CAT_SCRIPT]),
  });
  put(g, 'p1', 'Chrome Cat');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Chrome Cat', () => {
  test('entering reveals one and the answer clears', () => {
    const { g, revealed } = played();
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = played();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
