// `Typhoon` — the per-OPPONENT census: each opponent takes THEIR OWN Island
// count, which only a three-seat board with different boards can prove.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TYPHOON_SCRIPT } from './typhoon';
import { TYPHOON } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Typhoon';
const ISLAND = 'Island';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** p2 gets `two` Islands, p3 gets `three`, and p1 casts the Typhoon. */
function blown(two: number, three: number): Game {
  const g = startedGame({
    players: 3,
    decks: [[SPELL, ISLAND], [ISLAND], [ISLAND]],
    scripts: createRegistry([TYPHOON_SCRIPT]),
  });
  // p1 holds an Island too — the caster is never their own opponent.
  put(g, 'p1', ISLAND);
  for (let i = 0; i < two; i++) put(g, 'p2', ISLAND);
  for (let i = 0; i < three; i++) put(g, 'p3', ISLAND);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Typhoon', () => {
  test('each opponent takes their OWN count, and the caster takes nothing', () => {
    const g = blown(2, 3);
    expect(g.state.players.p2?.life).toBe(38);
    expect(g.state.players.p3?.life).toBe(37);
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('an opponent with no Islands takes nothing at all', () => {
    const g = blown(0, 1);
    expect(g.state.players.p2?.life).toBe(40);
    expect(g.state.players.p3?.life).toBe(39);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TYPHOON.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TYPHOON.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TYPHOON.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = blown(1, 1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
