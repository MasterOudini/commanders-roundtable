// `Omashu City` — tapped entry; the sacrifice-draw pays and draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OMASHU_CITY_SCRIPT } from './omashuCity';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function citied(): { g: Game; city: InstanceId; enteredTapped: boolean } {
  const g = startedGame({
    players: 2,
    decks: [['Omashu City'], []],
    scripts: createRegistry([OMASHU_CITY_SCRIPT]),
  });
  const city = put(g, 'p1', 'Omashu City');
  settle(g);
  const enteredTapped = g.state.cards[city]?.tapped === true;
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [city], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, city, enteredTapped };
}

describe('Omashu City', () => {
  test('enters tapped; the sacrifice-draw pays and draws', () => {
    const { g, city, enteredTapped } = citied();
    expect(enteredTapped).toBe(true);
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: city, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[city]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g, city } = citied();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: city, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
