// `Mana Geode` — the mana rock's entry asks a scry 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MANA_GEODE_SCRIPT } from './manaGeode';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function geoded(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Mana Geode'], ['Grizzly Bears']],
    scripts: createRegistry([MANA_GEODE_SCRIPT]),
  });
  settle(g);
  put(g, 'p1', 'Mana Geode');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Mana Geode', () => {
  test('the entry reveals the top card and the keep answer clears', () => {
    const { g, revealed } = geoded();
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = geoded();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
