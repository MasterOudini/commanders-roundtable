// `Testament Bearer` — dying reveals three; one goes to hand, the rest to the
// graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TESTAMENT_BEARER_SCRIPT } from './testamentBearer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BEARER = 'Testament Bearer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function killed(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[BEARER], []],
    scripts: createRegistry([TESTAMENT_BEARER_SCRIPT]),
  });
  const bearer = put(g, 'p1', BEARER);
  settle(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: bearer,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) as InstanceId[];
  return { g, revealed };
}

describe('Testament Bearer', () => {
  test('THREE are revealed; the pick goes to hand and the rest to the graveyard', () => {
    const { g, revealed } = killed();
    expect(revealed).toHaveLength(3);
    const keep = revealed[0] as InstanceId;
    const rest = revealed.slice(1);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [keep] }));
    settle(g);
    expect(g.state.cards[keep]?.zone.kind).toBe('hand');
    for (const id of rest) expect(g.state.cards[id]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = killed();
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [revealed[0] as InstanceId] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
