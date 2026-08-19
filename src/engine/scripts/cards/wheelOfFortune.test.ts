// `Wheel of Fortune` — every hand into the graveyard, seven back apiece:
// no prompt (a whole hand is a choiceless discard, CR 701.8a), and both
// libraries pay out through THE draw rule.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WHEEL_OF_FORTUNE_SCRIPT } from './wheelOfFortune';
import { WHEEL_OF_FORTUNE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Wheel of Fortune', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([WHEEL_OF_FORTUNE_SCRIPT]),
  });
  const spell = put(g, 'p1', 'Wheel of Fortune', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Wheel of Fortune', () => {
  test('both hands are seven fresh cards, the old ones in the graveyards, nothing asked', () => {
    const g = cast();
    expect(g.state.zones.hand['p1']?.length).toBe(7);
    expect(g.state.zones.hand['p2']?.length).toBe(7);
    expect((g.state.zones.graveyard['p1']?.length ?? 0)).toBeGreaterThan(0);
    expect((g.state.zones.graveyard['p2']?.length ?? 0)).toBeGreaterThan(0);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WHEEL_OF_FORTUNE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WHEEL_OF_FORTUNE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WHEEL_OF_FORTUNE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
