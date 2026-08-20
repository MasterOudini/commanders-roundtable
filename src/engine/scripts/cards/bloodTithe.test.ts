// `Blood Tithe` — the drain at a 2-player table: the opponent pays 3, the
// caster banks 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BLOOD_TITHE_SCRIPT } from './bloodTithe';
import { BLOOD_TITHE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tithed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Blood Tithe'], ['Grizzly Bears']],
    scripts: createRegistry([BLOOD_TITHE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Blood Tithe', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Blood Tithe', () => {
  test('the opponent pays 3 and the caster banks the total', () => {
    const g = tithed();
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BLOOD_TITHE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BLOOD_TITHE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BLOOD_TITHE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = tithed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
