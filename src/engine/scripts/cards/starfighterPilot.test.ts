// `Starfighter Pilot` — a Tier-3 tap raises the surveil.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STARFIGHTER_PILOT_SCRIPT } from './starfighterPilot';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function piloted(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Starfighter Pilot'], []],
    scripts: createRegistry([STARFIGHTER_PILOT_SCRIPT]),
  });
  const pilot = put(g, 'p1', 'Starfighter Pilot');
  settle(g);
  holdEverywhere(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [pilot], tapped: true }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const top = lib[lib.length - 1];
  if (top === undefined) throw new Error('empty library');
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  return g;
}

describe('Starfighter Pilot', () => {
  test('becoming tapped asks the surveil; the decline lands in the graveyard', () => {
    const g = piloted();
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = piloted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
