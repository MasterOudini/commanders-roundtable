// `Collective Unconscious` — draw per MY creature: two of mine, one of
// theirs pays two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { COLLECTIVE_UNCONSCIOUS_SCRIPT } from './collectiveUnconscious';
import { COLLECTIVE_UNCONSCIOUS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dreamed(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Collective Unconscious', 'Grizzly Bears', 'Llanowar Elves'], ['Grizzly Bears']],
    scripts: createRegistry([COLLECTIVE_UNCONSCIOUS_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Llanowar Elves');
  put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Collective Unconscious', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, before };
}

describe('Collective Unconscious', () => {
  test('two of MINE pay two draws; theirs does not count', () => {
    const { g, before } = dreamed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = COLLECTIVE_UNCONSCIOUS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, COLLECTIVE_UNCONSCIOUS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(COLLECTIVE_UNCONSCIOUS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = dreamed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
