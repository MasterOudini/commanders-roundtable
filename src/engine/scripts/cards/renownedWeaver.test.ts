// `Renowned Weaver` — trades herself for the Spider.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RENOWNED_WEAVER_SCRIPT } from './renownedWeaver';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function woven(): { g: Game; weaver: string } {
  const g = startedGame({
    players: 2,
    decks: [['Renowned Weaver'], []],
    scripts: createRegistry([RENOWNED_WEAVER_SCRIPT]),
  });
  const weaver = put(g, 'p1', 'Renowned Weaver');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: weaver, abilityIndex: 0 }));
  settle(g);
  return { g, weaver };
}

describe('Renowned Weaver', () => {
  test('the Weaver dies and the Spider stands', () => {
    const { g, weaver } = woven();
    expect(g.state.cards[weaver]?.zone.kind).toBe('graveyard');
    const spiders = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Spider');
    expect(spiders).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const { g } = woven();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
