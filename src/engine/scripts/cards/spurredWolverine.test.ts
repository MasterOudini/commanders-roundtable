// `Spurred Wolverine` — two untapped Beasts (itself and a Stomper) tap to
// give my bear first strike until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPURRED_WOLVERINE_SCRIPT } from './spurredWolverine';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WOLVERINE = 'Spurred Wolverine';
const STOMPER = 'Arborback Stomper';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function keywords(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([SPURRED_WOLVERINE_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function placed(): { g: Game; wolverine: InstanceId; stomper: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WOLVERINE, STOMPER, BEARS], []],
    scripts: createRegistry([SPURRED_WOLVERINE_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const stomper = put(g, 'p1', STOMPER);
  const wolverine = put(g, 'p1', WOLVERINE);
  settle(g);
  return { g, wolverine, stomper, bears };
}

describe('Spurred Wolverine (tap two Beasts)', () => {
  test('two Beasts tap; the bear gains first strike until cleanup', () => {
    const { g, wolverine, stomper, bears } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: wolverine, abilityIndex: 0, tap: [wolverine, stomper] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(keywords(g, bears).has('firstStrike')).toBe(true);
    expect(g.state.cards[stomper]?.tapped).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(keywords(g, bears).has('firstStrike')).toBe(false);
  });

  test('a bear is not a Beast', () => {
    const { g, wolverine, bears } = placed();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: wolverine, abilityIndex: 0, tap: [wolverine, bears] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, wolverine, stomper, bears } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: wolverine, abilityIndex: 0, tap: [wolverine, stomper] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
