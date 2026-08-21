// `Reduce to Dreams` — artifacts and enchantments on both boards go
// home; a creature stays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REDUCE_TO_DREAMS_SCRIPT } from './reduceToDreams';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dreamed(): { g: Game; ring: string; contemplation: string; bears: string } {
  const g = startedGame({
    players: 2,
    decks: [['Reduce to Dreams', 'Sol Ring'], ['Contemplation', 'Grizzly Bears']],
    scripts: createRegistry([REDUCE_TO_DREAMS_SCRIPT]),
  });
  const ring = put(g, 'p1', 'Sol Ring');
  const contemplation = put(g, 'p2', 'Contemplation');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Reduce to Dreams', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, ring, contemplation, bears };
}

describe('Reduce to Dreams', () => {
  test('both go to their owners hands; the creature stands', () => {
    const { g, ring, contemplation, bears } = dreamed();
    expect(g.state.cards[ring]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[contemplation]?.zone).toEqual({ kind: 'hand', player: 'p2' });
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = dreamed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
