// `Multani's Presence` — MY countered cast draws; the opponent's own
// spells resolving draw nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MULTANIS_PRESENCE_SCRIPT } from './multanisPresence';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function presenced(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [["Multani's Presence", 'Grizzly Bears'], ['Counterspell']],
    scripts: createRegistry([MULTANIS_PRESENCE_SCRIPT]),
  });
  put(g, 'p1', "Multani's Presence");
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
  const counter = put(g, 'p2', 'Counterspell', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
  advanceUntil(g, (s) => s.priority.player === 'p2' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack[g.state.stack.length - 1]?.id;
  if (!stackId) throw new Error('no spell on the stack to counter');
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'U', amount: 2 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p2',
      card: counter,
      targets: [{ kind: 'stack', id: stackId }],
    }),
  );
  settle(g);
  return { g, mid };
}

describe("Multani's Presence", () => {
  test('my countered Bears pays a draw', () => {
    const { g, mid } = presenced();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
    // The Bears really was countered.
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = presenced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
