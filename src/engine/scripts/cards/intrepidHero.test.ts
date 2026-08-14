// `Intrepid Hero` — the tap destroys a big creature; a small one is refused
// by D139's numeric spec.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { INTREPID_HERO_SCRIPT } from './intrepidHero';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HERO = 'Intrepid Hero';
const TITAN = 'Grave Titan';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; hero: InstanceId; titan: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [HERO, BEARS],
      [TITAN],
    ],
    scripts: createRegistry([INTREPID_HERO_SCRIPT]),
  });
  const hero = put(g, 'p1', HERO);
  const bears = put(g, 'p1', BEARS);
  const titan = put(g, 'p2', TITAN);
  settle(g);
  // {T} on a creature — wait out summoning sickness.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, hero, titan, bears };
}

describe('Intrepid Hero', () => {
  test('the tap destroys a power-6 creature', () => {
    const { g, hero, titan } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hero, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: titan }] }));
    settle(g);
    expect(g.state.cards[titan]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[hero]?.tapped).toBe(true);
  });

  test('a power-2 creature is refused — the numeric floor holds', () => {
    const { g, hero, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hero, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const r = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] });
    expect(r.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, hero, titan } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: hero, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: titan }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
