// `Paradox Gardens` — the activated surveil; the land survives.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PARADOX_GARDENS_SCRIPT } from './paradoxGardens';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gardened(): { g: Game; gardens: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Paradox Gardens'], []],
    scripts: createRegistry([PARADOX_GARDENS_SCRIPT]),
  });
  const gardens = put(g, 'p1', 'Paradox Gardens');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [gardens], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: gardens, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, gardens, revealed };
}

describe('Paradox Gardens', () => {
  test('the surveil asks and the land survives tapped', () => {
    const { g, gardens, revealed } = gardened();
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.cards[gardens]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[gardens]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = gardened();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
