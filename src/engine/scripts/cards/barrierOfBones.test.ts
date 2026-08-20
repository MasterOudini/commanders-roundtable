// `Barrier of Bones` — the ETB surveil behind Defender: enter, look at one,
// graveyard is a real answer.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BARRIER_OF_BONES_SCRIPT } from './barrierOfBones';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function played(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Barrier of Bones', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([BARRIER_OF_BONES_SCRIPT]),
  });
  put(g, 'p1', 'Barrier of Bones');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Barrier of Bones', () => {
  test('entering asks with toGraveyard SET; the send-away lands there', () => {
    const { g, revealed } = played();
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(true);
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(g.state.cards[revealed[0] as InstanceId]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = played();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
