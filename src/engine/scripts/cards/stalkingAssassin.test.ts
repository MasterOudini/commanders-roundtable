// `Stalking Assassin` - the tap ability taps an untapped Bears; the destroy ability
// accepts a TAPPED Bears and refuses an untapped one (D294); replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STALKING_ASSASSIN_SCRIPT } from './stalkingAssassin';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Stalking Assassin';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; tapped: InstanceId; untapped: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARD], [BEARS, BEARS]],
    scripts: createRegistry([STALKING_ASSASSIN_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const tapped = put(g, 'p2', BEARS);
  const untapped = put(g, 'p2', BEARS);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  // Tapped AFTER the wait: p2's own untap step (turn 2) would have untapped it.
  must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [tapped], tapped: true }));
  return { g, self, tapped, untapped };
}

describe('Stalking Assassin', () => {
  test('the tap ability taps an untapped creature', () => {
    const { g, self, untapped } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: untapped }] }));
    settle(g);
    expect(g.state.cards[untapped]?.tapped).toBe(true);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('the destroy ability accepts a tapped creature and destroys it', () => {
    const { g, self, tapped } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: tapped }] }));
    settle(g);
    expect(g.state.cards[tapped]?.zone.kind).toBe('graveyard');
  });

  test('the destroy ability refuses an untapped creature (D294)', () => {
    const { g, self, untapped } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: untapped }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, self, tapped } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: tapped }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
