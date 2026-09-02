// `Words of Wisdom` — I draw two, each OTHER player draws one.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WORDS_OF_WISDOM_SCRIPT } from './wordsOfWisdom';
import { WORDS_OF_WISDOM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Words of Wisdom';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; mine: number; theirs: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], []],
    scripts: createRegistry([WORDS_OF_WISDOM_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  // ⚠️ Baselines go BEHIND the put, which moved the spell into my hand.
  const mine = idsIn(g, 'p1', 'hand').length;
  const theirs = idsIn(g, 'p2', 'hand').length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs };
}

describe('Words of Wisdom', () => {
  test('I net +1 (two drawn, the spell gone); the opponent nets +1', () => {
    const { g, mine, theirs } = cast();
    expect(idsIn(g, 'p1', 'hand').length).toBe(mine - 1 + 2);
    expect(idsIn(g, 'p2', 'hand').length).toBe(theirs + 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WORDS_OF_WISDOM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WORDS_OF_WISDOM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WORDS_OF_WISDOM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
