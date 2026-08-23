// `Tura Kennerüd, Skyknight` — the instant-or-sorcery cast watcher, proven
// from both sides: a sorcery pays a Soldier, a creature spell pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TURA_KENNERUD_SKYKNIGHT_SCRIPT } from './turaKennerudSkyknight';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TURA = 'Tura Kennerüd, Skyknight';
const SORCERY = 'Tremor'; // {R} sorcery
const CREATURE = 'Grizzly Bears'; // {1}{G} creature

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function soldiers(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return c?.isToken && g.deps.oracle.byPrinting(c.printingId)?.name === 'Soldier';
  }).length;
}

function game(): Game {
  const g = startedGame({
    players: 2,
    decks: [[TURA, SORCERY, CREATURE], []],
    scripts: createRegistry([TURA_KENNERUD_SKYKNIGHT_SCRIPT]),
  });
  put(g, 'p1', TURA);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return g;
}

function cast(g: Game, name: string): void {
  const spell = put(g, 'p1', name, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
}

describe('Tura Kennerüd, Skyknight', () => {
  test('a SORCERY pays a Soldier; a creature spell pays nothing', () => {
    const g = game();
    cast(g, SORCERY);
    expect(soldiers(g)).toBe(1);
    cast(g, CREATURE);
    expect(soldiers(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = game();
    cast(g, SORCERY);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
