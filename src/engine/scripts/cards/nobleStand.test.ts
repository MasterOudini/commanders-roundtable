// `Noble Stand` — TWO of my creatures blocking fire TWICE (the D190
// fan-out): +4 life in one declaration.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NOBLE_STAND_SCRIPT } from './nobleStand';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stood(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      ['Noble Stand', 'Grizzly Bears', 'Aysen Bureaucrats'],
      ['Grizzly Bears', 'Aysen Bureaucrats'],
    ],
    scripts: createRegistry([NOBLE_STAND_SCRIPT]),
  });
  put(g, 'p1', 'Noble Stand');
  const myBears = put(g, 'p1', 'Grizzly Bears');
  const myClerk = put(g, 'p1', 'Aysen Bureaucrats');
  const theirBears = put(g, 'p2', 'Grizzly Bears');
  const theirClerk = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.priority.awaiting?.kind === 'declareAttackers' && s.turn.activePlayer === 'p2',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p2',
      attackers: [
        { card: theirBears, defender: { kind: 'player', id: 'p1' } },
        { card: theirClerk, defender: { kind: 'player', id: 'p1' } },
      ],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
  must(
    g.submit({
      t: 'DeclareBlockers',
      player: 'p1',
      blocks: [
        { blocker: myBears, attacker: theirBears },
        { blocker: myClerk, attacker: theirClerk },
      ],
    }),
  );
  settle(g);
  return g;
}

describe('Noble Stand', () => {
  test('two blockers in one declaration gain 4 — one firing per blocker', () => {
    const g = stood();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const g = stood();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
