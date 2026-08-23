// `Vial of Poison` — the Vial spends itself for a deathtouch grant that
// CLEANUP takes back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VIAL_OF_POISON_SCRIPT } from './vialOfPoison';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const VIAL = 'Vial of Poison';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; bears: InstanceId; vial: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[VIAL, BEARS], []],
    scripts: createRegistry([VIAL_OF_POISON_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const vial = put(g, 'p1', VIAL);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: vial, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, vial };
}

function keywords(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([VIAL_OF_POISON_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

describe('Vial of Poison', () => {
  test('the Vial sacrifices itself and the target gains deathtouch', () => {
    const { g, bears, vial } = granted();
    expect(g.state.cards[vial]?.zone.kind).toBe('graveyard');
    expect(keywords(g, bears).has('deathtouch')).toBe(true);
  });

  test('cleanup takes the grant back (CR 514.2)', () => {
    const { g, bears } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(keywords(g, bears).has('deathtouch')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
