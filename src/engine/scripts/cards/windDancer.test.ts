// `Wind Dancer` — it grants flying to something else while flying itself.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WIND_DANCER_SCRIPT } from './windDancer';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DANCER = 'Wind Dancer';
const BEARS = 'Grizzly Bears'; // grounded

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; dancer: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DANCER, BEARS], []],
    scripts: createRegistry([WIND_DANCER_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const dancer = put(g, 'p1', DANCER);
  settle(g);
  // Summoning sickness holds the {T} back until p1's next turn.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: dancer, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, dancer, bears };
}

function keywords(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([WIND_DANCER_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

describe('Wind Dancer', () => {
  test('the target gains flying and the Dancer taps', () => {
    const { g, dancer, bears } = granted();
    expect(keywords(g, bears).has('flying')).toBe(true);
    expect(g.state.cards[dancer]?.tapped).toBe(true);
  });

  test('the Dancer flies on its own line', () => {
    const { g, dancer } = granted();
    expect(keywords(g, dancer).has('flying')).toBe(true);
  });

  test('cleanup takes the grant back (CR 514.2)', () => {
    const { g, bears } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(keywords(g, bears).has('flying')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
