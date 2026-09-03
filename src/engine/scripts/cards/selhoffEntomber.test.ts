// `Selhoff Entomber` — the tap and a discarded CREATURE card buy a card; a
// land card does not pay.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SELHOFF_ENTOMBER_SCRIPT } from './selhoffEntomber';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ENTOMBER = 'Selhoff Entomber';
const BEARS = 'Grizzly Bears';
const ISLAND = 'Island';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function ready(): { g: Game; entomber: InstanceId; bearsInHand: InstanceId; islandInHand: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ENTOMBER, BEARS, ISLAND], []],
    scripts: createRegistry([SELHOFF_ENTOMBER_SCRIPT]),
  });
  const entomber = put(g, 'p1', ENTOMBER);
  const bearsInHand = put(g, 'p1', BEARS, 'hand');
  const islandInHand = put(g, 'p1', ISLAND, 'hand');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, entomber, bearsInHand, islandInHand };
}

describe('Selhoff Entomber (typed discard-cost chooser)', () => {
  test('a creature card pays and I draw', () => {
    const { g, entomber, bearsInHand } = ready();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: entomber, abilityIndex: 0, discard: [bearsInHand], targets: [] }));
    settle(g);
    expect(g.state.cards[bearsInHand]?.zone.kind).toBe('graveyard');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('a land card does not pay', () => {
    const { g, entomber, islandInHand } = ready();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: entomber, abilityIndex: 0, discard: [islandInHand], targets: [] }).ok).toBe(false);
    expect(g.state.cards[islandInHand]?.zone.kind).toBe('hand');
  });

  test('replays to the same hash', () => {
    const { g, entomber, bearsInHand } = ready();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: entomber, abilityIndex: 0, discard: [bearsInHand], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
