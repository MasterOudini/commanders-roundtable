// `Skybeast Tracker` — the MV filter proven both ways with two batch-mates:
// a 3-cost Sizzle pays nothing, a 6-cost Sip of Hemlock pays a Food.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SKYBEAST_TRACKER_SCRIPT } from './skybeastTracker';
import { SIZZLE_SCRIPT } from './sizzle';
import { SIP_OF_HEMLOCK_SCRIPT } from './sipOfHemlock';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): number {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken).length;
}

function tracked(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Skybeast Tracker', 'Sizzle', 'Sip of Hemlock'], ['Grizzly Bears']],
    scripts: createRegistry([SKYBEAST_TRACKER_SCRIPT, SIZZLE_SCRIPT, SIP_OF_HEMLOCK_SCRIPT]),
  });
  put(g, 'p1', 'Skybeast Tracker');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const cheap = put(g, 'p1', 'Sizzle', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: cheap }));
  settle(g);
  if (tokens(g) !== 0) throw new Error('the MV-3 cast must pay nothing');
  const big = put(g, 'p1', 'Sip of Hemlock', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: big }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return g;
}

describe('Skybeast Tracker', () => {
  test('only the mana-value-5-plus cast pays a Food', () => {
    const g = tracked();
    expect(tokens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = tracked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
