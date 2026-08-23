// `Vedalken Archmage` — the artifact cast filter, both sides in one game.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VEDALKEN_ARCHMAGE_SCRIPT } from './vedalkenArchmage';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ARCHMAGE = 'Vedalken Archmage';
const ARTIFACT = 'Sol Ring';
const CREATURE = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

function game(): Game {
  const g = startedGame({
    players: 2,
    decks: [[ARCHMAGE, ARTIFACT, CREATURE], []],
    scripts: createRegistry([VEDALKEN_ARCHMAGE_SCRIPT]),
  });
  put(g, 'p1', ARCHMAGE);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return g;
}

function cast(g: Game, name: string): number {
  const spell = put(g, 'p1', name, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  const since = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return drawn(g, since);
}

describe('Vedalken Archmage', () => {
  test('an ARTIFACT spell draws; a creature spell does not', () => {
    const g = game();
    expect(cast(g, ARTIFACT)).toBe(1);
    expect(cast(g, CREATURE)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = game();
    cast(g, ARTIFACT);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
