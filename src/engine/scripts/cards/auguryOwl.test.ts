// `Augury Owl` — the ETB scry at THREE: the count is the whole difference
// from the Temple shape, so the reveal size is the assertion.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AUGURY_OWL_SCRIPT } from './auguryOwl';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function played(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Augury Owl', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([AUGURY_OWL_SCRIPT]),
  });
  put(g, 'p1', 'Augury Owl');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Augury Owl', () => {
  test('entering reveals THREE and asks', () => {
    const { g, revealed } = played();
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.count).toBe(3);
    expect(revealed).toHaveLength(3);
  });

  test('a split answer keeps the kept order on top', () => {
    const { g, revealed } = played();
    const [a, b, c] = revealed as [InstanceId, InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [a, c], toBottom: [b] }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[lib.length - 1]).toBe(a);
    expect(lib[lib.length - 2]).toBe(c);
    expect(lib[0]).toBe(b);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = played();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
