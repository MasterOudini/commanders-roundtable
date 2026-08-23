// `Thieving Magpie` — Thieving Otter's exact ability on a second id, and the
// same two-event proof: combat and noncombat damage each draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THIEVING_MAGPIE_SCRIPT } from './thievingMagpie';
import { SOULS_FIRE_SCRIPT } from './soulsFire';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAGPIE = 'Thieving Magpie';
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

function game(): { g: Game; magpie: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAGPIE, FIRE], []],
    scripts: createRegistry([THIEVING_MAGPIE_SCRIPT, SOULS_FIRE_SCRIPT]),
  });
  const magpie = put(g, 'p1', MAGPIE);
  settle(g);
  holdEverywhere(g);
  return { g, magpie };
}

function pingWith(g: Game, magpie: InstanceId): number {
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
        { kind: 'card', id: magpie },
        { kind: 'player', id: 'p2' },
      ],
    }),
  );
  settle(g);
  return since;
}

describe('Thieving Magpie', () => {
  test('COMBAT damage draws a card', () => {
    const { g, magpie } = game();
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
        attackers: [{ card: magpie, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    // ⚠️ `settle()` alone returns at once — the stack is already empty the
    // moment attackers are declared. Combat damage is a STEP, so the walk has
    // to reach past it (Scroll Thief's test, D244, does the same).
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 120_000);
    settle(g);
    expect(drawn(g, since)).toBe(1);
  });

  test('NONCOMBAT damage draws one too', () => {
    const { g, magpie } = game();
    expect(drawn(g, pingWith(g, magpie))).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, magpie } = game();
    pingWith(g, magpie);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
