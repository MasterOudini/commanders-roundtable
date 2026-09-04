// D307 - THE FLASHBACK SEAM, the engine half: Beast Attack (no script) is cast
// from the graveyard for its flashback cost and exiled on resolution (a Beast
// token made); it is refused from the graveyard without a flashback cost (the
// mana cost alone does not do), a countered flashback spell is exiled, and the
// game replays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const ATTACK = 'Beast Attack';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function board(): { g: Game; attack: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ATTACK, 'Grizzly Bears', 'Forest', 'Forest'], ['Cyclops of One-Eyed Pass', 'Counterspell']],
    scripts: createRegistry([]),
  });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const attack = put(g, 'p1', ATTACK, 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, attack };
}

describe('Flashback casts from the graveyard and exiles (D307)', () => {
  test('cast from the graveyard for {2}{G}{G}{G}: the Beast token is made and the card is exiled', () => {
    const { g, attack } = board();
    const board0 = onBoard(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: attack, targets: [] }));
    settle(g);
    expect(g.state.cards[attack]?.zone.kind).toBe('exile');
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test('a countered flashback spell is exiled too', () => {
    const { g, attack } = board();
    const counter = put(g, 'p2', 'Counterspell', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: attack, targets: [] }));
    advanceUntil(g, (s) => s.priority.player === 'p2' && s.priority.awaiting === null && s.stack.length === 1, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'U', amount: 2 }));
    const spell = g.state.stack[0];
    if (!spell) throw new Error('no spell on the stack');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: counter, targets: [{ kind: 'stack', id: spell.id }] }));
    settle(g);
    expect(g.state.cards[attack]?.zone.kind).toBe('exile');
  });

  test('replays to the same hash', () => {
    const { g, attack } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: attack, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
