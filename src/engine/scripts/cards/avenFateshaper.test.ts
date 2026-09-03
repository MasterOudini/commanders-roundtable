// `Aven Fateshaper` — its entry shows me the top four to reorder, and five
// mana does it again.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AVEN_FATESHAPER_SCRIPT } from './avenFateshaper';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const AVEN = 'Aven Fateshaper';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shownTo(g: Game): InstanceId[] {
  const lib = g.state.zones.library['p1'] ?? [];
  return lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
}

function placed(): { g: Game; aven: InstanceId; shown: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[AVEN], []],
    scripts: createRegistry([AVEN_FATESHAPER_SCRIPT]),
  });
  const aven = put(g, 'p1', AVEN);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'orderCards', 20_000);
  return { g, aven, shown: shownTo(g) };
}

describe('Aven Fateshaper', () => {
  test('entering shows four cards and writes my order to the top', () => {
    const { g, shown } = placed();
    expect(shown.length).toBe(4);
    const [a, b, c, d] = shown as [InstanceId, InstanceId, InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [d, c, b, a] }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib.slice(lib.length - 4)).toEqual([a, b, c, d]);
  });

  test('{4}{U} looks again', () => {
    const { g, aven, shown } = placed();
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [...shown] }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: aven, abilityIndex: 0, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'orderCards', 20_000);
    const again = shownTo(g);
    expect(again.length).toBe(4);
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [...again].reverse() }));
    settle(g);
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib.slice(lib.length - 4)).toEqual(again);
  });

  test('replays to the same hash', () => {
    const { g, shown } = placed();
    must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: [...shown].reverse() }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
