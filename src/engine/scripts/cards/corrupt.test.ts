// `Corrupt` — Swamps power the burn AND the gain, at a player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CORRUPT_SCRIPT } from './corrupt';
import { CORRUPT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function corrupted(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Corrupt', 'Swamp', 'Swamp', 'Swamp'], ['Grizzly Bears']],
    scripts: createRegistry([CORRUPT_SCRIPT]),
  });
  put(g, 'p1', 'Swamp');
  put(g, 'p1', 'Swamp');
  put(g, 'p1', 'Swamp');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Corrupt', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return g;
}

describe('Corrupt', () => {
  test('three Swamps: 3 off the opponent, 3 to the caster', () => {
    const g = corrupted();
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CORRUPT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CORRUPT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CORRUPT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = corrupted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
