// `Soulscour` — everything nonartifact dies, lands included; the Sol Ring
// and the artifact-LAND both stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOULSCOUR_SCRIPT } from './soulscour';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function scoured(): { g: Game; bears: InstanceId; swamp: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Soulscour', 'Swamp'], ['Grizzly Bears', 'Sol Ring']],
    scripts: createRegistry([SOULSCOUR_SCRIPT]),
  });
  const swamp = put(g, 'p1', 'Swamp');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Soulscour', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 10 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, swamp, ring };
}

describe('Soulscour', () => {
  test('the Bears and the Swamp die; the Sol Ring stands', () => {
    const { g, bears, swamp, ring } = scoured();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[swamp]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = scoured();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
