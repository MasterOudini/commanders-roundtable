// `Spined Megalodon` — attacking raises the scry.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPINED_MEGALODON_SCRIPT } from './spinedMegalodon';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Spined Megalodon'], []],
    scripts: createRegistry([SPINED_MEGALODON_SCRIPT]),
  });
  const shark = put(g, 'p1', 'Spined Megalodon');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: shark, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const top = lib[lib.length - 1];
  if (top === undefined) throw new Error('empty library');
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [top], toBottom: [] }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  return g;
}

describe('Spined Megalodon', () => {
  test('the attack raises the scry and combat still lands', () => {
    const g = attacked();
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 60_000);
    expect(g.state.players['p2']?.life).toBeLessThan(40);
  });

  test('replays to the same hash', () => {
    const g = attacked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
