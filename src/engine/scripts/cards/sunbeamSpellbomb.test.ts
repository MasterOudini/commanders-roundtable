// `Sunbeam Spellbomb` — white mana and the Spellbomb buy 5 life; generic
// mana and the Spellbomb buy a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUNBEAM_SPELLBOMB_SCRIPT } from './sunbeamSpellbomb';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELLBOMB = 'Sunbeam Spellbomb';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function board(): { g: Game; bomb: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELLBOMB], []],
    scripts: createRegistry([SUNBEAM_SPELLBOMB_SCRIPT]),
  });
  const bomb = put(g, 'p1', SPELLBOMB);
  settle(g);
  return { g, bomb };
}

describe('Sunbeam Spellbomb', () => {
  test('{W}, sacrifice: 5 life', () => {
    const { g, bomb } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bomb, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(45);
    expect(g.state.cards[bomb]?.zone.kind).toBe('graveyard');
  });

  test('{1}, sacrifice: a card', () => {
    const { g, bomb } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bomb, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[bomb]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, bomb } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bomb, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
