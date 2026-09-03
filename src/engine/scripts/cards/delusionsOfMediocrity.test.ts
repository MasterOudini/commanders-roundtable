// `Delusions of Mediocrity` - entering gains 10 life, leaving loses it again; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DELUSIONS_OF_MEDIOCRITY_SCRIPT } from './delusionsOfMediocrity';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Delusions of Mediocrity';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; self: InstanceId; life0: number } {
  const g = startedGame({ players: 2, decks: [[CARD], ['Grizzly Bears']], scripts: createRegistry([DELUSIONS_OF_MEDIOCRITY_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
  return { g, self, life0 };
}

describe('Delusions of Mediocrity', () => {
  test('entering gains 10 life', () => {
    const { g, life0 } = entered();
    expect(g.state.players.p1?.life).toBe(life0 + 10);
  });

  test('leaving the battlefield loses the 10 again', () => {
    const { g, self, life0 } = entered();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(life0);
  });

  test('replays to the same hash', () => {
    const { g, self } = entered();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
