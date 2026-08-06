// `Arms Dealer` — the chooser's first SUBTYPE predicate: a Goblin pays, a
// bear does not, and the 4 damage kills through the SBA.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARMS_DEALER_SCRIPT } from './armsDealer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DEALER = 'Arms Dealer';
const GOBLIN = 'Krenko, Mob Boss';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; dealer: InstanceId; goblin: InstanceId; myBears: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DEALER, GOBLIN, BEARS], [BEARS]],
    scripts: createRegistry([ARMS_DEALER_SCRIPT]),
  });
  const dealer = put(g, 'p1', DEALER);
  const goblin = put(g, 'p1', GOBLIN);
  const myBears = put(g, 'p1', BEARS);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, dealer, goblin, myBears, bears };
}

describe('Arms Dealer', () => {
  test('a Goblin pays, and the 4 damage kills the target through the SBA', () => {
    const { g, dealer, goblin, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: dealer, abilityIndex: 0, sacrifice: goblin }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    expect(g.state.cards[goblin]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[dealer]?.zone.kind).toBe('battlefield');
  });

  test('a NON-Goblin creature cannot pay the Goblin-only cost', () => {
    // ⚠️ Not the Dealer itself — "Sacrifice a Goblin" is not "another", and
    // the Dealer IS a Goblin Rogue: eating itself is legal per the card. The
    // illegal pick is my own genuinely Goblin-less bear.
    const { g, dealer, myBears } = game();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: dealer, abilityIndex: 0, sacrifice: myBears });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, dealer, goblin, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: dealer, abilityIndex: 0, sacrifice: goblin }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
