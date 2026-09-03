// `Swift Kick` — the pump-then-fight.
//
// ⚠️ The pair is submitted SWAPPED in the second case on purpose.
// `assignTargets` (D102) is a one-for-one MATCHING: it proves a legal
// assignment exists and does NOT reorder the answer, so the swap is
// ACCEPTED and `obj.targets[0]` is the opponent's creature. A resolve that
// read positionally would pump the wrong side; this is what makes reading
// by CONTROLLER load-bearing.
//
// ⚠️ MY creature is a Grave Titan, not a Bears: `+1/+0` leaves toughness
// alone, so a pumped 2/2 fighting a 2/2 TRADES — the engine corrected an
// earlier draft that expected it to survive. A 6/6 survives, and its
// derived power of 7 is what proves the pump landed on my side.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SWIFT_KICK_SCRIPT } from './swiftKick';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kicked(swap: boolean): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Swift Kick', 'Grave Titan'], ['Grizzly Bears']],
    scripts: createRegistry([SWIFT_KICK_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grave Titan');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Swift Kick', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const targets = swap
    ? [
        { kind: 'card' as const, id: theirs },
        { kind: 'card' as const, id: mine },
      ]
    : [
        { kind: 'card' as const, id: mine },
        { kind: 'card' as const, id: theirs },
      ];
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets }));
  settle(g);
  return { g, mine, theirs };
}

describe('Swift Kick', () => {
  test('my pumped Titan kills the 2/2 and survives its 2 back', () => {
    const { g, mine, theirs } = kicked(false);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(7);
  });

  // ⚠️ D288: until then this case pinned a MEASURED engine bug — the aim
  // accepted the swapped answer and the resolution-time re-check (CR
  // 608.2b) read the specs POSITIONALLY and fizzled the spell. The re-check
  // now asks whether SOME clause admits each target, the same search the
  // aim used, so the swapped answer resolves — and because this resolve
  // reads CONTROLLERS, it resolves RIGHT.
  test('a swapped answer is accepted and resolves with the roles read by controller (D288)', () => {
    const { g, mine, theirs } = kicked(true);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, mine).power).toBe(7);
  });

  test('replays to the same hash', () => {
    const { g } = kicked(false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
