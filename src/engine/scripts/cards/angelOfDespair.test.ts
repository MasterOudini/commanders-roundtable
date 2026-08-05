// `Angel of Despair` — the first script DESTROY, with the indestructible break
// carried by a real card: `Darksteel Myr` survives the same trigger that kills
// a Lion.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ANGEL_OF_DESPAIR_SCRIPT } from './angelOfDespair';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ANGEL = 'Angel of Despair';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function enters(g: Game, angel: InstanceId, target: InstanceId): void {
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: angel, to: { kind: 'battlefield', player: 'p1' } }));
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
}

describe('Angel of Despair', () => {
  test('destroys the targeted permanent', () => {
    const g = startedGame({
      players: 2,
      decks: [[ANGEL], ['Silvercoat Lion']],
      scripts: createRegistry([ANGEL_OF_DESPAIR_SCRIPT]),
    });
    const lion = put(g, 'p2', 'Silvercoat Lion');
    settle(g);
    const angel = put(g, 'p1', ANGEL, 'graveyard');
    settle(g);
    enters(g, angel, lion);
    expect(g.state.cards[lion]?.zone.kind).toBe('graveyard');
  });

  test('an INDESTRUCTIBLE target survives — the def asks the derived keyword', () => {
    const g = startedGame({
      players: 2,
      decks: [[ANGEL], ['Darksteel Myr']],
      scripts: createRegistry([ANGEL_OF_DESPAIR_SCRIPT]),
    });
    const myr = put(g, 'p2', 'Darksteel Myr');
    settle(g);
    const angel = put(g, 'p1', ANGEL, 'graveyard');
    settle(g);
    enters(g, angel, myr);
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[ANGEL], ['Silvercoat Lion']],
      scripts: createRegistry([ANGEL_OF_DESPAIR_SCRIPT]),
    });
    const lion = put(g, 'p2', 'Silvercoat Lion');
    settle(g);
    const angel = put(g, 'p1', ANGEL, 'graveyard');
    settle(g);
    enters(g, angel, lion);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
