// `Waterfront Bouncer` — blue mana, the tap and a discarded card return the
// opponent's bear to their hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WATERFRONT_BOUNCER_SCRIPT } from './waterfrontBouncer';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BOUNCER = 'Waterfront Bouncer';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; bouncer: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BOUNCER], [BEARS]],
    scripts: createRegistry([WATERFRONT_BOUNCER_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const bouncer = put(g, 'p1', BOUNCER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, bouncer, theirs };
}

describe('Waterfront Bouncer', () => {
  test('{U}, {T}, discard a card: their bear returns to their hand', () => {
    const { g, bouncer, theirs } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bouncer, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'hand', player: 'p2' });
  });

  test('replays to the same hash', () => {
    const { g, bouncer, theirs } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bouncer, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
