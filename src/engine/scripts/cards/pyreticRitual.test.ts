// `Pyretic Ritual` — Dark Ritual's red twin, proven on its own oracle id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { PYRETIC_RITUAL_SCRIPT } from './pyreticRitual';
import { PYRETIC_RITUAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Pyretic Ritual'], ['Grizzly Bears']],
    scripts: createRegistry([PYRETIC_RITUAL_SCRIPT]),
  });
  const ritual = put(g, 'p1', 'Pyretic Ritual', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: ritual }));
  settle(g);
  return g;
}

describe('Pyretic Ritual', () => {
  test('{1}{R} in, {R}{R}{R} out', () => {
    const g = cast();
    expect(g.state.players['p1']?.pool.R).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = PYRETIC_RITUAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, PYRETIC_RITUAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(PYRETIC_RITUAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
