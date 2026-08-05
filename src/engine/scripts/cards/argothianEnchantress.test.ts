// `Argothian Enchantress` — the cast-type check is the card: an enchantment
// spell draws, a creature spell does not, and both are proven by counting the
// library→hand moves the draw rule writes.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARGOTHIAN_ENCHANTRESS_SCRIPT } from './argothianEnchantress';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ENCHANTRESS = 'Argothian Enchantress';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[ENCHANTRESS, "Ajani's Mantra", 'Grizzly Bears'], []],
    scripts: createRegistry([ARGOTHIAN_ENCHANTRESS_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some(
          (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
        ),
    ).length;
}

describe('Argothian Enchantress', () => {
  test('casting an ENCHANTMENT draws a card', () => {
    const g = game();
    put(g, 'p1', ENCHANTRESS);
    settle(g);
    const mantra = put(g, 'p1', "Ajani's Mantra", 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mantra, targets: [] }));
    settle(g);
    expect(g.state.cards[mantra]?.zone.kind).toBe('battlefield');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('a CREATURE spell draws nothing — the type is asked of the cast face', () => {
    const g = game();
    put(g, 'p1', ENCHANTRESS);
    settle(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', ENCHANTRESS);
    settle(g);
    const mantra = put(g, 'p1', "Ajani's Mantra", 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mantra, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
