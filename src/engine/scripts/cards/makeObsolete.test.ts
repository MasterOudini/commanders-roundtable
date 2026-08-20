// `Make Obsolete` — their 1/1 dies to -1/-1; my 1/1 is untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MAKE_OBSOLETE_SCRIPT } from './makeObsolete';
import { MAKE_OBSOLETE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function obsoleted(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Make Obsolete', 'Elvish Herder'], ['Elvish Herder']],
    scripts: createRegistry([MAKE_OBSOLETE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Elvish Herder');
  const theirs = put(g, 'p2', 'Elvish Herder');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Make Obsolete', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs };
}

describe('Make Obsolete', () => {
  test("their 1/1 dies; mine stands", () => {
    const { g, mine, theirs } = obsoleted();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MAKE_OBSOLETE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MAKE_OBSOLETE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MAKE_OBSOLETE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = obsoleted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
