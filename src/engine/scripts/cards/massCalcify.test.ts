// `Mass Calcify` — the nonwhite creatures die; the white one stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MASS_CALCIFY_SCRIPT } from './massCalcify';
import { MASS_CALCIFY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function calcified(): { g: Game; bears: InstanceId; clerk: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mass Calcify', 'Aysen Bureaucrats'], ['Grizzly Bears']],
    scripts: createRegistry([MASS_CALCIFY_SCRIPT]),
  });
  const clerk = put(g, 'p1', 'Aysen Bureaucrats');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Mass Calcify', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, clerk };
}

describe('Mass Calcify', () => {
  test('the green 2/2 dies; the white 1/1 stands', () => {
    const { g, bears, clerk } = calcified();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[clerk]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MASS_CALCIFY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MASS_CALCIFY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MASS_CALCIFY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = calcified();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
