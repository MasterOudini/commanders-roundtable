// `Kindle` — two namesakes across BOTH graveyards make X = 4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { KINDLE_SCRIPT } from './kindle';
import { KINDLE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kindled(): { g: Game } {
  const g = startedGame({
    players: 2,
    decks: [['Kindle', 'Kindle'], ['Kindle']],
    scripts: createRegistry([KINDLE_SCRIPT]),
  });
  put(g, 'p1', 'Kindle', 'graveyard');
  put(g, 'p2', 'Kindle', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Kindle', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g };
}

describe('Kindle', () => {
  test('2 plus one namesake in EACH graveyard: 4 damage', () => {
    const { g } = kindled();
    expect(g.state.players['p2']?.life).toBe(36);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = KINDLE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, KINDLE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(KINDLE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = kindled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
