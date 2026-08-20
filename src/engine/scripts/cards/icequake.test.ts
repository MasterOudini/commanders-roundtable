// `Icequake` — the land dies either way; the 1 damage only when it WAS
// snow.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ICEQUAKE_SCRIPT } from './icequake';
import { ICEQUAKE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function quaked(name: string): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Icequake', 'Icequake'], ['Snow-Covered Swamp', 'Swamp']],
    scripts: createRegistry([ICEQUAKE_SCRIPT]),
  });
  const land = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Icequake', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
  settle(g);
  return { g, land };
}

describe('Icequake', () => {
  test('a snow land dies and its controller takes 1', () => {
    const { g, land } = quaked('Snow-Covered Swamp');
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('a plain Swamp dies and nobody is burned', () => {
    const { g, land } = quaked('Swamp');
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ICEQUAKE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ICEQUAKE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ICEQUAKE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = quaked('Snow-Covered Swamp');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
