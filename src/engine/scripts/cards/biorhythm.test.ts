// `Biorhythm` — every living player's life BECOMES their creature count.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BIORHYTHM_SCRIPT } from './biorhythm';
import { BIORHYTHM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Biorhythm', 'Grizzly Bears', 'Llanowar Elves'], ['Colossal Dreadmaw']],
    scripts: createRegistry([BIORHYTHM_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Llanowar Elves');
  put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Biorhythm', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 8 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Biorhythm', () => {
  test('two creatures = 2 life; one creature = 1 life', () => {
    const g = cast();
    expect(g.state.players['p1']?.life).toBe(2);
    expect(g.state.players['p2']?.life).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BIORHYTHM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BIORHYTHM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BIORHYTHM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
