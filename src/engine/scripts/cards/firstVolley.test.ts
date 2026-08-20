// `First Volley` — 1 to the 1/1 (it dies) and 1 to its controller.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FIRST_VOLLEY_SCRIPT } from './firstVolley';
import { FIRST_VOLLEY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function volleyed(): { g: Game; strix: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['First Volley'], ['Baleful Strix']],
    scripts: createRegistry([FIRST_VOLLEY_SCRIPT]),
  });
  const strix = put(g, 'p2', 'Baleful Strix');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'First Volley', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: strix }] }));
  settle(g);
  return { g, strix };
}

describe('First Volley', () => {
  test('the 1/1 dies and its controller takes 1', () => {
    const { g, strix } = volleyed();
    expect(g.state.cards[strix]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FIRST_VOLLEY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FIRST_VOLLEY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FIRST_VOLLEY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = volleyed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
