// `Sinister Starfish` — {T}: Surveil 1 at #a0; a creature's tap waits for
// turn 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SINISTER_STARFISH_SCRIPT } from './sinisterStarfish';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function surveilled(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Sinister Starfish'], []],
    scripts: createRegistry([SINISTER_STARFISH_SCRIPT]),
  });
  const fish = put(g, 'p1', 'Sinister Starfish');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: fish, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const top = lib[lib.length - 1];
  if (top === undefined) throw new Error('empty library');
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  return g;
}

describe('Sinister Starfish', () => {
  test('the surveilled card can fall into the graveyard', () => {
    const g = surveilled();
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = surveilled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
