// `Mana Short` — their lands turn and their pool empties.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MANA_SHORT_SCRIPT } from './manaShort';
import { MANA_SHORT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shorted(): { g: Game; swamp: InstanceId; mountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mana Short'], ['Swamp', 'Mountain']],
    scripts: createRegistry([MANA_SHORT_SCRIPT]),
  });
  const swamp = put(g, 'p2', 'Swamp');
  const mountain = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p2', symbol: 'U', amount: 2 }));
  const spell = put(g, 'p1', 'Mana Short', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, swamp, mountain };
}

describe('Mana Short', () => {
  test('both their lands turn and their {U}{U} vanishes', () => {
    const { g, swamp, mountain } = shorted();
    expect(g.state.cards[swamp]?.tapped).toBe(true);
    expect(g.state.cards[mountain]?.tapped).toBe(true);
    expect(g.state.players['p2']?.pool.U).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MANA_SHORT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MANA_SHORT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MANA_SHORT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = shorted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
