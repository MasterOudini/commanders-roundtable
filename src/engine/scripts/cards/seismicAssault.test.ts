// `Seismic Assault` — a discarded LAND card (no mana) deals 2 to the
// opponent; a creature card does not pay.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEISMIC_ASSAULT_SCRIPT } from './seismicAssault';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ASSAULT = 'Seismic Assault';
const ISLAND = 'Island';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; assault: InstanceId; island: InstanceId; bearsInHand: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ASSAULT, ISLAND, BEARS], []],
    scripts: createRegistry([SEISMIC_ASSAULT_SCRIPT]),
  });
  const assault = put(g, 'p1', ASSAULT);
  const island = put(g, 'p1', ISLAND, 'hand');
  const bearsInHand = put(g, 'p1', BEARS, 'hand');
  settle(g);
  return { g, assault, island, bearsInHand };
}

describe('Seismic Assault (typed discard-cost chooser)', () => {
  test('a land card pays: 2 damage to the opponent', () => {
    const { g, assault, island } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: assault, abilityIndex: 0, discard: [island] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.cards[island]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
  });

  test('a creature card does not pay', () => {
    const { g, assault, bearsInHand } = placed();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: assault, abilityIndex: 0, discard: [bearsInHand] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, assault, island } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: assault, abilityIndex: 0, discard: [island] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
