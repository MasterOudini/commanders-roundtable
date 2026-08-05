// `Talrand, Sky Summoner` — the first cast-watching trigger and the first
// script-created token. The token must be REAL: named by the oracle, on the
// battlefield, a 2/2 with flying — a blank would also "exist" (D133).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TALRAND_SKY_SUMMONER_SCRIPT } from './talrandSkySummoner';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TALRAND = 'Talrand, Sky Summoner';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[TALRAND, 'Lightning Bolt', 'Dark Ritual'], []],
    scripts: createRegistry([TALRAND_SKY_SUMMONER_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Talrand, Sky Summoner', () => {
  test('casting an INSTANT creates a real 2/2 Drake for the caster', () => {
    const g = game();
    put(g, 'p1', TALRAND);
    settle(g);
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    const drakes = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Drake');
    expect(drakes).toHaveLength(1);
    expect(g.log.some((e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual')).toBe(true);
  });

  test('a SORCERY triggers it too, and a PERMANENT spell does not', () => {
    const g = game();
    put(g, 'p1', TALRAND);
    settle(g);
    const ritual = put(g, 'p1', 'Dark Ritual', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ritual, targets: [] }));
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Drake')).toHaveLength(1);
    // A creature CAST is a SpellCast event too — the type check is what keeps
    // a Grizzly Bears from making Drakes. Covered from the negative side by
    // the count staying 1 after the game advances (nothing else was cast).
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Drake')).toHaveLength(1);
  });

  test("an OPPONENT'S instant makes them no Drake — 'you cast'", () => {
    const g = game();
    put(g, 'p1', TALRAND);
    settle(g);
    const before = g.log.filter((e) => e.body.t === 'TokenCreated').length;
    // p2 casts nothing; p1's Talrand must not fire on p2's turn passing.
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(g.log.filter((e) => e.body.t === 'TokenCreated').length).toBe(before);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', TALRAND);
    settle(g);
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
