// `Tura Kennerüd, Skyknight` — the instant-or-sorcery cast watcher, proven
// from both sides: a sorcery pays a Soldier, a creature spell pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { TURA_KENNERUD_SKYKNIGHT_SCRIPT } from './turaKennerudSkyknight';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TURA = 'Tura Kennerüd, Skyknight';
const SORCERY = 'Tremor'; // {R} sorcery
const CREATURE = 'Grizzly Bears'; // {1}{G} creature

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

// ⚠️ D383 - COUNTED OFF THE LOG, NOT OFF THE BOARD. The sorcery this test casts is `Tremor`
// ("deals 1 damage to each creature without flying"), a sentence the SCOPED BOARD EFFECT reads
// now - so the spell that fires the trigger sweeps the 1/1 Soldier the trigger just made, and a
// board count reads zero for a def that worked perfectly. The trigger is what this test is about,
// and `TokenCreated` is where the trigger says so (D260's rule, D383's own lesson one subject
// over: a sweep catches every creature on the board, including the ones the test put there).
function soldiers(g: Game): number {
  return g.log.filter((e) => {
    if (e.body.t !== 'TokenCreated') return false;
    return g.deps.oracle.byPrinting(e.body.printingId)?.name === 'Soldier';
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
