// `Fruition` — the first untargeted, board-computed SpellDef: counts EVERY
// Forest on the battlefield, opponents' included, by derived subtypes.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FRUITION_SCRIPT } from './fruition';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(g: Game, card: string): void {
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card }));
  settle(g);
}

describe('Fruition', () => {
  test('counts every Forest on the battlefield, opponents included', () => {
    const g = startedGame({
      players: 2,
      decks: [
        ['Fruition', 'Forest', 'Forest', 'Mountain'],
        ['Forest'],
      ],
      scripts: createRegistry([FRUITION_SCRIPT]),
    });
    put(g, 'p1', 'Forest');
    put(g, 'p1', 'Forest');
    put(g, 'p1', 'Mountain');
    put(g, 'p2', 'Forest');
    settle(g);
    const fruition = put(g, 'p1', 'Fruition', 'hand');
    cast(g, fruition);
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('zero Forests gains nothing, and the spell still resolves to the graveyard', () => {
    const g = startedGame({
      players: 2,
      decks: [['Fruition'], []],
      scripts: createRegistry([FRUITION_SCRIPT]),
    });
    const fruition = put(g, 'p1', 'Fruition', 'hand');
    cast(g, fruition);
    expect(g.state.players['p1']?.life).toBe(40);
    expect(g.state.cards[fruition]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Fruition', 'Forest'], []],
      scripts: createRegistry([FRUITION_SCRIPT]),
    });
    put(g, 'p1', 'Forest');
    settle(g);
    const fruition = put(g, 'p1', 'Fruition', 'hand');
    cast(g, fruition);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
