// `Forum of Amity` — enters TAPPED, and the paid #a1 surveil asks.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FORUM_OF_AMITY_SCRIPT } from './forumOfAmity';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function convened(): { g: Game; forum: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Forum of Amity', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([FORUM_OF_AMITY_SCRIPT]),
  });
  const forum = put(g, 'p1', 'Forum of Amity');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  expect(g.state.cards[forum]?.tapped).toBe(true);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [forum], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: forum, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, forum, revealed };
}

describe('Forum of Amity', () => {
  test('enters TAPPED; the paid surveil asks and binning lands one in the graveyard', () => {
    const { g, revealed } = convened();
    expect(revealed).toHaveLength(1);
    const grave = (g.state.zones.graveyard['p1'] ?? []).length;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(grave + 1);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = convened();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
