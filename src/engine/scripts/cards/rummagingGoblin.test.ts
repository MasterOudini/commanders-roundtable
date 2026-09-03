// `Rummaging Goblin` — the discard chooser (D286): the named card leaves my
// hand in the cost batch and I draw; an activation that names nothing, or
// names a card not in my hand, is refused; with an empty hand the ability is
// not offered at all.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { legalActions } from '../../legal';
import { RUMMAGING_GOBLIN_SCRIPT } from './rummagingGoblin';
import { advanceUntil, deps, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GOBLIN = 'Rummaging Goblin';

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

function offered(g: Game, card: InstanceId, index: number): boolean {
  const d = deps(createRegistry([RUMMAGING_GOBLIN_SCRIPT]));
  return legalActions(g.state, d.oracle, d.scripts, 'p1').some(
    (a) => a.t === 'ActivateAbility' && a.card === card && a.abilityIndex === index,
  );
}

function ready(): { g: Game; goblin: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GOBLIN], []],
    scripts: createRegistry([RUMMAGING_GOBLIN_SCRIPT]),
  });
  const goblin = put(g, 'p1', GOBLIN);
  settle(g);
  // Turn 3 is my next turn: the Goblin can tap and I hold priority.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, goblin };
}

describe('Rummaging Goblin (discard-cost chooser)', () => {
  test('the named card is discarded in the cost batch and I draw', () => {
    const { g, goblin } = ready();
    const hand = idsIn(g, 'p1', 'hand');
    const chosen = hand[0] as InstanceId;
    expect(offered(g, goblin, 0)).toBe(true);
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: goblin, abilityIndex: 0, discard: [chosen] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(g.state.cards[goblin]?.tapped).toBe(true);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(idsIn(g, 'p1', 'hand').length).toBe(hand.length);
  });

  test('naming nothing, or a card not in my hand, is refused', () => {
    const { g, goblin } = ready();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: goblin, abilityIndex: 0 }).ok).toBe(false);
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: goblin, abilityIndex: 0, discard: [goblin] }).ok).toBe(false);
    expect(g.state.cards[goblin]?.tapped).toBe(false);
  });

  test('with an empty hand the ability is not offered', () => {
    const { g, goblin } = ready();
    for (const id of idsIn(g, 'p1', 'hand')) {
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'graveyard', player: 'p1' } }));
    }
    expect(idsIn(g, 'p1', 'hand').length).toBe(0);
    expect(offered(g, goblin, 0)).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, goblin } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: goblin, abilityIndex: 0, discard: [chosen] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
