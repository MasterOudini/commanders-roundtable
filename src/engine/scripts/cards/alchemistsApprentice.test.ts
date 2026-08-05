// `Alchemist's Apprentice` — a cost that is ONLY the self-sacrifice: no mana,
// no tap, and the draw resolves with the Apprentice already dead.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ALCHEMISTS_APPRENTICE_SCRIPT } from './alchemistsApprentice';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const APPRENTICE = "Alchemist's Apprentice";

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[APPRENTICE], []],
    scripts: createRegistry([ALCHEMISTS_APPRENTICE_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe("Alchemist's Apprentice", () => {
  test('sacrifice-only cost: no mana needed, dead at activation, draw on resolution', () => {
    const g = game();
    const id = put(g, 'p1', APPRENTICE);
    settle(g);
    const handBefore = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 0 }));
    expect(g.state.cards[id]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(handBefore + 1);
  });

  test('replays to the same hash', () => {
    const g = game();
    const id = put(g, 'p1', APPRENTICE);
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
