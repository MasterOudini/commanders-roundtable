// `Shatterstorm` — every artifact dies; the indestructible artifact and
// the creature stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHATTERSTORM_SCRIPT } from './shatterstorm';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function stormed(): { g: Game; ring: InstanceId; citadel: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Shatterstorm', 'Darksteel Citadel'],
      ['Sol Ring', 'Grizzly Bears'],
    ],
    scripts: createRegistry([SHATTERSTORM_SCRIPT]),
  });
  const citadel = put(g, 'p1', 'Darksteel Citadel');
  const ring = put(g, 'p2', 'Sol Ring');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Shatterstorm', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, ring, citadel, bears };
}

describe('Shatterstorm', () => {
  test('the artifact dies; the indestructible and the creature stand', () => {
    const { g, ring, citadel, bears } = stormed();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[citadel]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = stormed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
