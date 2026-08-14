// `Kamahl, Pit Fighter` — the tap deals 3 to the chosen player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KAMAHL_PIT_FIGHTER_SCRIPT } from './kamahlPitFighter';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const KAMAHL = 'Kamahl, Pit Fighter';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pinged(): Game {
  const g = startedGame({
    players: 2,
    decks: [[KAMAHL], []],
    scripts: createRegistry([KAMAHL_PIT_FIGHTER_SCRIPT]),
  });
  const kamahl = put(g, 'p1', KAMAHL);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: kamahl, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe('Kamahl, Pit Fighter', () => {
  test('the tap deals 3 to the chosen player', () => {
    const g = pinged();
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('replays to the same hash', () => {
    const g = pinged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
