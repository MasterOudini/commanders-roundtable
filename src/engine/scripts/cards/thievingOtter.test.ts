// `Thieving Otter` — the connect-draw on BOTH damage events.
//
// ⚠️ The second case is the one that matters, and it is a COMPOSITION rather
// than a synthetic event: the printed word is "damage", not "combat damage",
// so a NONCOMBAT source has to pay — and the engine has no manual
// deal-damage tool, so the noncombat hit is produced by casting the SHIPPED
// `Soul's Fire` (D250) with the Otter as its source and the opponent as its
// target. Scroll Thief (D244) watches `CombatDamageDealt` alone and is right
// to — its text says combat. A combat-only Otter would have under-fired on
// every ping, silently.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THIEVING_OTTER_SCRIPT } from './thievingOtter';
import { SOULS_FIRE_SCRIPT } from './soulsFire';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const OTTER = 'Thieving Otter';
const FIRE = "Soul's Fire";

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

function game(): { g: Game; otter: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[OTTER, FIRE], []],
    scripts: createRegistry([THIEVING_OTTER_SCRIPT, SOULS_FIRE_SCRIPT]),
  });
  const otter = put(g, 'p1', OTTER);
  settle(g);
  holdEverywhere(g);
  return { g, otter };
}

/** Casts Soul's Fire so the OTTER deals noncombat damage to p2. */
function pingWithOtter(g: Game, otter: InstanceId): number {
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', FIRE, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  const since = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: otter },
        { kind: 'player', id: 'p2' },
      ],
    }),
  );
  settle(g);
  return since;
}

describe('Thieving Otter', () => {
  test('COMBAT damage to an opponent draws a card', () => {
    const { g, otter } = game();
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
        attackers: [{ card: otter, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    // ⚠️ `settle()` alone returns at once — the stack is already empty the
    // moment attackers are declared. Combat damage is a STEP, so the walk has
    // to reach past it (Scroll Thief's test, D244, does the same).
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 120_000);
    settle(g);
    expect(drawn(g, since)).toBe(1);
  });

  test('NONCOMBAT damage draws one too — the word is "damage", not "combat damage"', () => {
    const { g, otter } = game();
    const since = pingWithOtter(g, otter);
    expect(drawn(g, since)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, otter } = game();
    pingWithOtter(g, otter);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
