// `Tanglespan Lookout` — the Aura-entry watcher.
//
// ⚠️ The Aura is CAST, never `put()` — an Aura placed on the battlefield
// attached to nothing is binned by the aura-falls SBA before anything can
// attach it (D218). The draws are counted off the `DrewCards` marker (D189)
// rather than off hand size, because the cast itself moves a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TANGLESPAN_LOOKOUT_SCRIPT } from './tanglespanLookout';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const LOOKOUT = 'Tanglespan Lookout';
const AURA = 'Pacifism';
const MANTRA = "Ajani's Mantra";
const BEARS = 'Grizzly Bears';

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

/** Casts an Aura from `caster`'s hand at a creature; returns the draws p1 saw. */
function auraCast(caster: 'p1' | 'p2'): { g: Game; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [[LOOKOUT, AURA, BEARS], [AURA]],
    scripts: createRegistry([TANGLESPAN_LOOKOUT_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', LOOKOUT);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === caster &&
      s.priority.player === caster &&
      s.priority.awaiting === null &&
      (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    40_000,
  );
  const aura = put(g, caster, AURA, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: caster, target: caster, symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: caster, target: caster, symbol: 'C', amount: 2 }));
  const since = g.log.length;
  must(g.submit({ t: 'CastSpell', player: caster, card: aura }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: caster, targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, drew: drawn(g, since) };
}

describe('Tanglespan Lookout', () => {
  test('MY Aura entering draws a card', () => {
    expect(auraCast('p1').drew).toBe(1);
  });

  test("an OPPONENT's Aura draws nothing", () => {
    expect(auraCast('p2').drew).toBe(0);
  });

  test('a non-Aura enchantment of mine draws nothing — the filter is the SUBTYPE', () => {
    const g = startedGame({
      players: 2,
      decks: [[LOOKOUT, MANTRA], []],
      scripts: createRegistry([TANGLESPAN_LOOKOUT_SCRIPT]),
    });
    put(g, 'p1', LOOKOUT);
    settle(g);
    const since = g.log.length;
    put(g, 'p1', MANTRA);
    settle(g);
    expect(drawn(g, since)).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g } = auraCast('p1');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
