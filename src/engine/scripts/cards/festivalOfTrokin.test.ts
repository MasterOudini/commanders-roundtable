// `Festival of Trokin` — two creatures pay 4 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FESTIVAL_OF_TROKIN_SCRIPT } from './festivalOfTrokin';
import { FESTIVAL_OF_TROKIN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function celebrated(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Festival of Trokin', 'Grizzly Bears', 'Colossal Dreadmaw'], ['Grizzly Bears']],
    scripts: createRegistry([FESTIVAL_OF_TROKIN_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Colossal Dreadmaw');
  put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Festival of Trokin', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g };
}

describe('Festival of Trokin', () => {
  test('two of MY creatures pay 4; the opponent\'s does not count', () => {
    const { g } = celebrated();
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FESTIVAL_OF_TROKIN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FESTIVAL_OF_TROKIN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FESTIVAL_OF_TROKIN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = celebrated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
