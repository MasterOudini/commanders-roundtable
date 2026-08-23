// `Tribal Flames` — Domain counts basic land TYPES, not lands: five Forests
// are one, and that is what the test proves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TRIBAL_FLAMES_SCRIPT } from './tribalFlames';
import { TRIBAL_FLAMES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Tribal Flames';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function burned(lands: readonly string[]): Game {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, ...lands], []],
    scripts: createRegistry([TRIBAL_FLAMES_SCRIPT]),
  });
  lands.forEach((n) => put(g, 'p1', n));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe('Tribal Flames', () => {
  test('three DISTINCT basic types is 3 damage', () => {
    expect(burned(['Mountain', 'Forest', 'Island']).state.players.p2?.life).toBe(37);
  });

  test('three Mountains is ONE — the count is types, not lands', () => {
    expect(burned(['Mountain', 'Mountain', 'Mountain']).state.players.p2?.life).toBe(39);
  });

  test('no lands is a true no-op', () => {
    expect(burned([]).state.players.p2?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TRIBAL_FLAMES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TRIBAL_FLAMES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TRIBAL_FLAMES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = burned(['Mountain', 'Forest']);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
