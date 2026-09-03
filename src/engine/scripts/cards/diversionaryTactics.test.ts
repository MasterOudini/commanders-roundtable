// `Diversionary Tactics` — the tap chooser with a count of TWO: both named
// creatures tap and the target creature is tapped; one named is refused;
// with a single untapped creature the ability is not offered.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { legalActions } from '../../legal';
import { DIVERSIONARY_TACTICS_SCRIPT } from './diversionaryTactics';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TACTICS = 'Diversionary Tactics';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function offered(g: Game, card: InstanceId): boolean {
  const d = deps(createRegistry([DIVERSIONARY_TACTICS_SCRIPT]));
  return legalActions(g.state, d.oracle, d.scripts, 'p1').some(
    (a) => a.t === 'ActivateAbility' && a.card === card && a.abilityIndex === 0,
  );
}

function placed(two: boolean): { g: Game; tactics: InstanceId; a: InstanceId; b: InstanceId | null; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TACTICS, BEARS, NIGHTHAWK], [BEARS]],
    scripts: createRegistry([DIVERSIONARY_TACTICS_SCRIPT]),
  });
  const a = put(g, 'p1', BEARS);
  const b = two ? put(g, 'p1', NIGHTHAWK) : null;
  const theirs = put(g, 'p2', BEARS);
  const tactics = put(g, 'p1', TACTICS);
  settle(g);
  return { g, tactics, a, b, theirs };
}

describe('Diversionary Tactics (tap two)', () => {
  test('two named creatures tap and the target is tapped', () => {
    const { g, tactics, a, b, theirs } = placed(true);
    expect(offered(g, tactics)).toBe(true);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tactics, abilityIndex: 0, tap: [a, b as InstanceId] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[a]?.tapped).toBe(true);
    expect(g.state.cards[b as InstanceId]?.tapped).toBe(true);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('one named creature is refused', () => {
    const { g, tactics, a } = placed(true);
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: tactics, abilityIndex: 0, tap: [a] }).ok).toBe(false);
    expect(g.state.cards[a]?.tapped).toBe(false);
  });

  test('with a single untapped creature the ability is not offered', () => {
    const { g, tactics } = placed(false);
    expect(offered(g, tactics)).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, tactics, a, b, theirs } = placed(true);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tactics, abilityIndex: 0, tap: [a, b as InstanceId] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
