// `Windrider Patrol` — the connect trigger asks a scry 2.
//
// ⚠️ D232's trap: `settle()` returns BEFORE combat damage, so a test that
// settles after declaring attackers reads ZERO against a correct script.
// Advance to `postcombatMain` instead.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WINDRIDER_PATROL_SCRIPT } from './windriderPatrol';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PATROL = 'Windrider Patrol';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function connected(): Game {
  const g = startedGame({
    players: 2,
    decks: [[PATROL], []],
    scripts: createRegistry([WINDRIDER_PATROL_SCRIPT]),
  });
  const patrol = put(g, 'p1', PATROL);
  settle(g);
  holdEverywhere(g);
  // Past summoning sickness, onto one of my own turns with an attack step.
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
      attackers: [{ card: patrol, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  // ⚠️ Combat damage happens AFTER settle() would return — advance by PHASE.
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 120_000);
  return g;
}

describe('Windrider Patrol', () => {
  test('connecting asks a SCRY 2', () => {
    const g = connected();
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
    expect(
      g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.count,
    ).toBe(2);
    expect(
      g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard,
    ).toBe(false);
  });

  test('the Patrol flies', () => {
    const g = connected();
    const patrol = g.state.zones.battlefield.find(
      (id) => g.deps.oracle.byPrinting(g.state.cards[id]!.printingId)?.name === PATROL,
    ) as InstanceId;
    const d = deps(createRegistry([WINDRIDER_PATROL_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, patrol).keywords.has('flying')).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = connected();
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
