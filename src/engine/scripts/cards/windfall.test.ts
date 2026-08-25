// `Windfall` — every hand goes to the graveyard, then EVERY player draws the
// GREATEST number any one player discarded. The two seats are given DIFFERENT
// hand sizes so "greatest" and "your own" cannot both pass.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WINDFALL_SCRIPT } from './windfall';
import { WINDFALL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Windfall';
const FILLER = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; greatest: number } {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, FILLER, FILLER, FILLER],
      [FILLER, FILLER, FILLER, FILLER, FILLER],
    ],
    scripts: createRegistry([WINDFALL_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  // ⚠️ Read the hands with the spell ALREADY on the stack — that is the state
  // the resolve will see, and the greatest of the two is what everyone draws.
  const mine = idsIn(g, 'p1', 'hand').length;
  const theirs = idsIn(g, 'p2', 'hand').length;
  const greatest = Math.max(mine, theirs);
  settle(g);
  return { g, greatest };
}

describe('Windfall', () => {
  test('both players end with the GREATEST hand size, not their own', () => {
    const { g, greatest } = cast();
    expect(greatest).toBeGreaterThan(0);
    expect(idsIn(g, 'p1', 'hand').length).toBe(greatest);
    expect(idsIn(g, 'p2', 'hand').length).toBe(greatest);
  });

  test('the old hands are in the graveyards', () => {
    const { g } = cast();
    expect(idsIn(g, 'p1', 'graveyard').length).toBeGreaterThan(0);
    expect(idsIn(g, 'p2', 'graveyard').length).toBeGreaterThan(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WINDFALL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WINDFALL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WINDFALL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
