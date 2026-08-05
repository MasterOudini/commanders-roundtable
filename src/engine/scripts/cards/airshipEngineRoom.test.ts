// `Airship Engine Room` — a LAND that pays itself away, and it also enters
// tapped (D134's built-in): both rules on one card, working together.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AIRSHIP_ENGINE_ROOM_SCRIPT } from './airshipEngineRoom';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ROOM = 'Airship Engine Room';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[ROOM], []],
    scripts: createRegistry([AIRSHIP_ENGINE_ROOM_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Airship Engine Room', () => {
  test('enters tapped (the built-in), then sacrifices itself for a card once untapped', () => {
    const g = game();
    const id = put(g, 'p1', ROOM);
    settle(g);
    expect(g.state.cards[id]?.tapped).toBe(true);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [id], tapped: false }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    const handBefore = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[id]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(handBefore + 1);
  });

  test('replays to the same hash', () => {
    const g = game();
    const id = put(g, 'p1', ROOM);
    settle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [id], tapped: false }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
