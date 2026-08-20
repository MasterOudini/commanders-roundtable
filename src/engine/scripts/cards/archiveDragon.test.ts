// `Archive Dragon` — the ETB scry 2 behind two tier-2 keyword lines: the
// def claims only the trigger line, and Ward {2} stays the engine's.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARCHIVE_DRAGON_SCRIPT } from './archiveDragon';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function played(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Archive Dragon', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([ARCHIVE_DRAGON_SCRIPT]),
  });
  put(g, 'p1', 'Archive Dragon');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Archive Dragon', () => {
  test('entering reveals TWO and asks', () => {
    const { g, revealed } = played();
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.count).toBe(2);
    expect(revealed).toHaveLength(2);
  });

  test('bottoming both leaves them at indexes 0 and 1', () => {
    const { g, revealed } = played();
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [a, b] }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib.slice(0, 2)).toContain(a);
    expect(lib.slice(0, 2)).toContain(b);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = played();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
