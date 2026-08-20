// `Grim Flowering` — draws per creature CARD in my graveyard; the Sol
// Ring in there counts for nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GRIM_FLOWERING_SCRIPT } from './grimFlowering';
import { GRIM_FLOWERING } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flowered(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Grim Flowering', 'Grizzly Bears', 'Elvish Herder', 'Sol Ring'], []],
    scripts: createRegistry([GRIM_FLOWERING_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears', 'graveyard');
  put(g, 'p1', 'Elvish Herder', 'graveyard');
  put(g, 'p1', 'Sol Ring', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Grim Flowering', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  settle(g);
  return { g, mid };
}

describe('Grim Flowering', () => {
  test('two dead creatures draw two', () => {
    const { g, mid } = flowered();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GRIM_FLOWERING.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GRIM_FLOWERING.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GRIM_FLOWERING.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = flowered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
