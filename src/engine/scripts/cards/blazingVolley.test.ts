// `Blazing Volley` — 1 damage to each OPPOSING creature: their 1/1 dies,
// their 6/6 is scratched, mine is untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BLAZING_VOLLEY_SCRIPT } from './blazingVolley';
import { BLAZING_VOLLEY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function volleyed(): { g: Game; elf: InstanceId; maw: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Blazing Volley', 'Grizzly Bears'], ['Llanowar Elves', 'Colossal Dreadmaw']],
    scripts: createRegistry([BLAZING_VOLLEY_SCRIPT]),
  });
  const elf = put(g, 'p2', 'Llanowar Elves');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  const mine = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Blazing Volley', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, elf, maw, mine };
}

describe('Blazing Volley', () => {
  test('their 1/1 dies, their 6/6 is scratched, MINE untouched', () => {
    const { g, elf, maw, mine } = volleyed();
    expect(g.state.cards[elf]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.damage).toBe(1);
    expect(g.state.cards[mine]?.damage ?? 0).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BLAZING_VOLLEY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BLAZING_VOLLEY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BLAZING_VOLLEY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = volleyed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
