// `Fyndhorn Brownie` — the creature untap: a TAPPED target straightens, an
// upright one gets no event.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FYNDHORN_BROWNIE_SCRIPT } from './fyndhornBrownie';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BROWNIE = 'Fyndhorn Brownie';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function untaps(g: Game, card: InstanceId): number {
  return g.log.filter((e) => e.body.t === 'PermanentsUntapped' && e.body.cards.includes(card))
    .length;
}

function board(): { g: Game; brownie: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BROWNIE], [BEARS]],
    scripts: createRegistry([FYNDHORN_BROWNIE_SCRIPT]),
  });
  const brownie = put(g, 'p1', BROWNIE);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, brownie, bears };
}

describe('Fyndhorn Brownie', () => {
  test('untaps the tapped target', () => {
    const { g, brownie, bears } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [bears], tapped: true }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: brownie,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(false);
    expect(untaps(g, bears)).toBe(1);
  });

  test('an UPRIGHT target gets no event', () => {
    const { g, brownie, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: brownie,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(untaps(g, bears)).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g, brownie, bears } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [bears], tapped: true }));
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: brownie,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
