// `Wing Storm` — per-player arithmetic: the two seats take DIFFERENT amounts
// from one resolve, and a player with no flyers takes nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WING_STORM_SCRIPT } from './wingStorm';
import { WING_STORM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Wing Storm';
const FLYER = 'Serra Angel';
const GROUNDED = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** p2 gets TWO flyers, p1 gets ONE flyer and a grounded body. Expect 4 / 2. */
function cast(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, FLYER, GROUNDED],
      [FLYER, FLYER],
    ],
    scripts: createRegistry([WING_STORM_SCRIPT]),
  });
  put(g, 'p1', FLYER);
  put(g, 'p1', GROUNDED);
  put(g, 'p2', FLYER);
  put(g, 'p2', FLYER);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Wing Storm', () => {
  test('each player takes TWICE their own flyers — 2 for me, 4 for them', () => {
    const g = cast();
    expect(g.state.players['p1']?.life).toBe(38);
    expect(g.state.players['p2']?.life).toBe(36);
  });

  test('a grounded creature adds nothing to its controller', () => {
    const g = cast();
    // p1 has one flyer AND a Bear; 2 not 4 is the Bear being ignored.
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WING_STORM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WING_STORM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WING_STORM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
