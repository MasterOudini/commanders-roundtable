// `Requiem Angel` — a non-Spirit death pays a Spirit; that Spirit's own
// death pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REQUIEM_ANGEL_SCRIPT } from './requiemAngel';
import { advanceUntil, find, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spirits(g: Game): string[] {
  return g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Spirit') as string[];
}

describe('Requiem Angel', () => {
  test('a Bears death mints a Spirit; the Spirit dying mints nothing more', () => {
    const g = startedGame({
      players: 2,
      decks: [['Requiem Angel', 'Grizzly Bears'], []],
      scripts: createRegistry([REQUIEM_ANGEL_SCRIPT]),
    });
    put(g, 'p1', 'Requiem Angel');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(spirits(g)).toHaveLength(1);
    const spirit = find(g, 'p1', 'battlefield', 'Spirit') as string;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: spirit, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(spirits(g)).toHaveLength(0);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Requiem Angel', 'Grizzly Bears'], []],
      scripts: createRegistry([REQUIEM_ANGEL_SCRIPT]),
    });
    put(g, 'p1', 'Requiem Angel');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
