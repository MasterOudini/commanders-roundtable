// `Temple of Abandon` — both printed entry rules: tapped, and the scry that asks.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TEMPLE_OF_ABANDON_SCRIPT } from './templeOfAbandon';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TEMPLE = 'Temple of Abandon';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; temple: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TEMPLE], []],
    scripts: createRegistry([TEMPLE_OF_ABANDON_SCRIPT]),
  });
  const temple = put(g, 'p1', TEMPLE, 'hand');
  must(g.submit({ t: 'PlayLand', player: 'p1', card: temple }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  return { g, temple };
}

describe('Temple of Abandon', () => {
  test('enters tapped AND asks the scry — both printed rules', () => {
    const { g, temple } = entered();
    expect(g.state.cards[temple]?.tapped).toBe(true);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) as InstanceId[];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
