// `Harnessed Snubhorn` - an unblocked attack returns an artifact card from the
// graveyard to the battlefield; a creature card in the graveyard is refused; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HARNESSED_SNUBHORN_SCRIPT } from './harnessedSnubhorn';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Harnessed Snubhorn';
const RING = 'Sol Ring';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function struck(): { g: Game; ring: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, RING, BEARS], [BEARS]], scripts: createRegistry([HARNESSED_SNUBHORN_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const ring = put(g, 'p1', RING, 'graveyard');
  const bears = put(g, 'p1', BEARS, 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
  // Unblocked: the damage step fires the trigger, which asks for its target.
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, ring, bears };
}

describe('Harnessed Snubhorn', () => {
  test('combat damage to a player returns the artifact card to the battlefield', () => {
    const { g, ring } = struck();
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[ring]?.controller).toBe('p1');
  });

  test('a creature card in the graveyard is refused', () => {
    const { g, bears } = struck();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, ring } = struck();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
