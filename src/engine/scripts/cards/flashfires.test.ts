// `Flashfires` — every Plains dies on both boards; the Mountain stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FLASHFIRES_SCRIPT } from './flashfires';
import { FLASHFIRES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function burned(): { g: Game; plains: InstanceId; mountain: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Flashfires'], ['Plains', 'Mountain']],
    scripts: createRegistry([FLASHFIRES_SCRIPT]),
  });
  const plains = put(g, 'p2', 'Plains');
  const mountain = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Flashfires', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, plains, mountain };
}

describe('Flashfires', () => {
  test('the Plains dies; the Mountain stands', () => {
    const { g, plains, mountain } = burned();
    expect(g.state.cards[plains]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mountain]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FLASHFIRES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FLASHFIRES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FLASHFIRES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = burned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
