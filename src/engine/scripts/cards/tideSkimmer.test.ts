// `Tide Skimmer` — the attacker count filtered by a DERIVED keyword.
//
// ⚠️ The third case is the point: a creature that has flying only because
// something GRANTED it counts exactly as a printed flyer does, because the
// matcher asks `ctx.derive`. The aim layer's parse could never see that.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TIDE_SKIMMER_SCRIPT } from './tideSkimmer';
import { THOPTER_ARCHITECT_SCRIPT } from './thopterArchitect';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SKIMMER = 'Tide Skimmer';
const FLYER = 'Air Elemental';
const GROUND = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

/** Attacks with the Skimmer plus `mate`, and reports p1's draws. */
function swing(mate: string): number {
  const g = startedGame({
    players: 2,
    decks: [[SKIMMER, FLYER, GROUND], []],
    scripts: createRegistry([TIDE_SKIMMER_SCRIPT]),
  });
  const skimmer = put(g, 'p1', SKIMMER);
  const other = put(g, 'p1', mate);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  const since = g.log.length;
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [
        { card: skimmer, defender: { kind: 'player', id: 'p2' } },
        { card: other, defender: { kind: 'player', id: 'p2' } },
      ],
    }),
  );
  settle(g);
  return drawn(g, since);
}

describe('Tide Skimmer', () => {
  test('TWO flyers attacking draws a card', () => {
    expect(swing(FLYER)).toBe(1);
  });

  test('one flyer and one ground creature draws nothing', () => {
    expect(swing(GROUND)).toBe(0);
  });

  test('a GRANTED flyer counts — the matcher reads the DERIVED keyword', () => {
    const g = startedGame({
      players: 2,
      decks: [[SKIMMER, GROUND, 'Sol Ring', 'Thopter Architect'], []],
      scripts: createRegistry([TIDE_SKIMMER_SCRIPT, THOPTER_ARCHITECT_SCRIPT]),
    });
    const skimmer = put(g, 'p1', SKIMMER);
    const bears = put(g, 'p1', GROUND);
    put(g, 'p1', 'Thopter Architect');
    settle(g);
    holdEverywhere(g);
    advanceUntil(
      g,
      (s) =>
        s.turn.turnNumber >= 3 &&
        s.turn.activePlayer === 'p1' &&
        s.priority.awaiting === null &&
        s.turn.phase === 'precombatMain',
      120_000,
    );
    // An artifact entering makes the Architect grant the Bears flying.
    put(g, 'p1', 'Sol Ring');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 120_000);
    const since = g.log.length;
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: skimmer, defender: { kind: 'player', id: 'p2' } },
          { card: bears, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    settle(g);
    expect(drawn(g, since)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[SKIMMER, FLYER], []],
      scripts: createRegistry([TIDE_SKIMMER_SCRIPT]),
    });
    const skimmer = put(g, 'p1', SKIMMER);
    const other = put(g, 'p1', FLYER);
    settle(g);
    holdEverywhere(g);
    advanceUntil(
      g,
      (s) =>
        s.turn.turnNumber >= 3 &&
        s.turn.activePlayer === 'p1' &&
        s.priority.awaiting?.kind === 'declareAttackers',
      120_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: skimmer, defender: { kind: 'player', id: 'p2' } },
          { card: other, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
