// `Soul's Grace` — the gain IS the target's derived power, an opponent's
// Titan included.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOULS_GRACE_SCRIPT } from './soulsGrace';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function graced(): Game {
  const g = startedGame({
    players: 2,
    decks: [["Soul's Grace"], ['Grave Titan']],
    scripts: createRegistry([SOULS_GRACE_SCRIPT]),
  });
  const titan = put(g, 'p2', 'Grave Titan');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Soul's Grace", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: titan }] }));
  settle(g);
  return g;
}

describe("Soul's Grace", () => {
  test('the caster gains the 6', () => {
    const g = graced();
    expect(g.state.players['p1']?.life).toBe(46);
  });

  test('replays to the same hash', () => {
    const g = graced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
