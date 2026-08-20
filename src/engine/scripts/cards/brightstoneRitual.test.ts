// `Brightstone Ritual` — {R} per Goblin ANYWHERE on the battlefield,
// theirs included.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BRIGHTSTONE_RITUAL_SCRIPT } from './brightstoneRitual';
import { BRIGHTSTONE_RITUAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Brightstone Ritual', () => {
  test("two Goblins — one THEIRS — put {R}{R} in the pool", () => {
    const g = startedGame({
      players: 2,
      // Akki Drillmaster is a Goblin; one on each side both count.
      decks: [['Brightstone Ritual', 'Akki Drillmaster'], ['Akki Drillmaster']],
      scripts: createRegistry([BRIGHTSTONE_RITUAL_SCRIPT]),
    });
    put(g, 'p1', 'Akki Drillmaster');
    put(g, 'p2', 'Akki Drillmaster');
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
    const spell = put(g, 'p1', 'Brightstone Ritual', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    expect(g.state.players['p1']?.pool.R).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BRIGHTSTONE_RITUAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BRIGHTSTONE_RITUAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BRIGHTSTONE_RITUAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Brightstone Ritual', 'Akki Drillmaster'], []],
      scripts: createRegistry([BRIGHTSTONE_RITUAL_SCRIPT]),
    });
    put(g, 'p1', 'Akki Drillmaster');
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
    const spell = put(g, 'p1', 'Brightstone Ritual', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
