// `Tome of the Guildpact` — the multicolored cast filter on an artifact,
// proven from both sides in one game.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TOME_OF_THE_GUILDPACT_SCRIPT } from './tomeOfTheGuildpact';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TOME = 'Tome of the Guildpact';
const GOLD = 'Baleful Strix'; // {U}{B} — two colours
const MONO = 'Grizzly Bears'; // {1}{G} — one colour

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

function cast(g: Game, name: string): number {
  const spell = put(g, 'p1', name, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  const since = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return drawn(g, since);
}

function game(): Game {
  const g = startedGame({
    players: 2,
    decks: [[TOME, GOLD, MONO], []],
    scripts: createRegistry([TOME_OF_THE_GUILDPACT_SCRIPT]),
  });
  put(g, 'p1', TOME);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return g;
}

describe('Tome of the Guildpact', () => {
  test('a two-colour spell draws; a mono-colour spell does not', () => {
    const g = game();
    expect(cast(g, GOLD)).toBe(1);
    expect(cast(g, MONO)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = game();
    cast(g, GOLD);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
