// `Imperial Subduer` — a LONE Samurai attack asks and taps; two attackers
// pay nothing ("attacks alone").

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { IMPERIAL_SUBDUER_SCRIPT } from './imperialSubduer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SUBDUER = 'Imperial Subduer';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function alone(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SUBDUER, BEARS],
      [BEARS],
    ],
    scripts: createRegistry([IMPERIAL_SUBDUER_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const subduer = put(g, 'p1', SUBDUER);
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    20_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: subduer, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, theirs };
}

describe('Imperial Subduer', () => {
  test("a lone Samurai attack taps the chosen creature I don't control", () => {
    const { g, theirs } = alone();
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('TWO attackers pay nothing — "attacks alone"', () => {
    const g = startedGame({
      players: 2,
      decks: [
        [SUBDUER, BEARS],
        [BEARS],
      ],
      scripts: createRegistry([IMPERIAL_SUBDUER_SCRIPT]),
    });
    const theirs = put(g, 'p2', BEARS);
    const subduer = put(g, 'p1', SUBDUER);
    const mine = put(g, 'p1', BEARS);
    settle(g);
    advanceUntil(
      g,
      (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
      20_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: subduer, defender: { kind: 'player', id: 'p2' } },
          { card: mine, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 20_000);
    expect(g.state.cards[theirs]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = alone();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
