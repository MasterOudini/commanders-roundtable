// `Arasta of the Endless Web` — Talrand's mirror: the OPPONENT'S cast makes
// the Spider, the controller's own cast makes nothing, and the token belongs
// to Arasta's controller.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARASTA_OF_THE_ENDLESS_WEB_SCRIPT } from './arastaOfTheEndlessWeb';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ARASTA = 'Arasta of the Endless Web';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [
      [ARASTA, 'Lightning Bolt'],
      ['Dark Ritual'],
    ],
    scripts: createRegistry([ARASTA_OF_THE_ENDLESS_WEB_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Arasta of the Endless Web', () => {
  test("an opponent's instant makes p1 a Spider; p1's own cast makes none", () => {
    const g = game();
    put(g, 'p1', ARASTA);
    settle(g);
    // p2 casts Dark Ritual — an opponent's sorcery-speed spell needs p2's own
    // main phase; advance to it, then fund and cast.
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.priority.player === 'p2' && s.stack.length === 0, 20_000);
    const ritual = put(g, 'p2', 'Dark Ritual', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p2', card: ritual, targets: [] }));
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Spider')).toHaveLength(1);
    expect(battlefieldOf(g, 'p2').filter((id) => nameOf(g, id) === 'Spider')).toHaveLength(0);
    // p1's own Bolt must NOT make a second Spider.
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.priority.player === 'p1' && s.stack.length === 0, 20_000);
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Spider')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', ARASTA);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
