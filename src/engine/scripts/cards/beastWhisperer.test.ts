// `Beast Whisperer` — a creature spell draws, an enchantment spell does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BEAST_WHISPERER_SCRIPT } from './beastWhisperer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WHISPERER = 'Beast Whisperer';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[WHISPERER, 'Grizzly Bears', "Ajani's Mantra"], []],
    scripts: createRegistry([BEAST_WHISPERER_SCRIPT]),
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

describe('Beast Whisperer', () => {
  test('casting a CREATURE draws a card; an ENCHANTMENT does not', () => {
    const g = game();
    put(g, 'p1', WHISPERER);
    settle(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    let logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);

    const mantra = put(g, 'p1', "Ajani's Mantra", 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mantra, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', WHISPERER);
    settle(g);
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
