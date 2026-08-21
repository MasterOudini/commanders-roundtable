// `Secret Rendezvous` — both sides draw three.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SECRET_RENDEZVOUS_SCRIPT } from './secretRendezvous';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function met(): { g: Game; mine: number; theirs: number } {
  const g = startedGame({
    players: 2,
    decks: [['Secret Rendezvous'], []],
    scripts: createRegistry([SECRET_RENDEZVOUS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Secret Rendezvous', 'hand');
  const mine = (g.state.zones.hand['p1'] ?? []).length;
  const theirs = (g.state.zones.hand['p2'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, mine, theirs };
}

describe('Secret Rendezvous', () => {
  test('both sides draw three', () => {
    const { g, mine, theirs } = met();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine - 1 + 3);
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirs + 3);
  });

  test('replays to the same hash', () => {
    const { g } = met();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
