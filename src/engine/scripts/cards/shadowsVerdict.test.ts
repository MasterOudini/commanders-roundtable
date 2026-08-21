// `Shadows' Verdict` — mv 2 exiles from BOTH zones; the mv-6 body
// stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHADOWS_VERDICT_SCRIPT } from './shadowsVerdict';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function verdicted(): { g: Game; small: InstanceId; maw: InstanceId; buried: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ["Shadows' Verdict", 'Colossal Dreadmaw'],
      ['Grizzly Bears', 'Aysen Bureaucrats'],
    ],
    scripts: createRegistry([SHADOWS_VERDICT_SCRIPT]),
  });
  const small = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p1', 'Colossal Dreadmaw');
  const buried = put(g, 'p2', 'Aysen Bureaucrats', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Shadows' Verdict", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, small, maw, buried };
}

describe("Shadows' Verdict", () => {
  test('mv 2 exiles from battlefield AND graveyard; the mv-6 stands', () => {
    const { g, small, maw, buried } = verdicted();
    expect(g.state.cards[small]?.zone.kind).toBe('exile');
    expect(g.state.cards[buried]?.zone.kind).toBe('exile');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = verdicted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
