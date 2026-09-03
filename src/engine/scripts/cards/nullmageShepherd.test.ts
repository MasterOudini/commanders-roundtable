// `Nullmage Shepherd` — four untapped creatures (itself among them) tap to
// destroy the opponent's artifact.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NULLMAGE_SHEPHERD_SCRIPT } from './nullmageShepherd';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SHEPHERD = 'Nullmage Shepherd';
const OTHERS = ['Grizzly Bears', 'Vampire Nighthawk', 'Child of Night'];
const STAFF = 'Staff of Nin';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; shepherd: InstanceId; others: InstanceId[]; staff: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SHEPHERD, ...OTHERS], [STAFF]],
    scripts: createRegistry([NULLMAGE_SHEPHERD_SCRIPT]),
  });
  const staff = put(g, 'p2', STAFF);
  const others = OTHERS.map((n) => put(g, 'p1', n));
  const shepherd = put(g, 'p1', SHEPHERD);
  settle(g);
  return { g, shepherd, others, staff };
}

describe('Nullmage Shepherd (tap four creatures)', () => {
  test('four creatures tap; their Staff is destroyed', () => {
    const { g, shepherd, others, staff } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: shepherd, abilityIndex: 0, tap: [shepherd, ...others] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }] }));
    settle(g);
    expect(g.state.cards[staff]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    for (const id of [shepherd, ...others]) expect(g.state.cards[id]?.tapped).toBe(true);
  });

  test('three are refused', () => {
    const { g, shepherd, others } = placed();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: shepherd, abilityIndex: 0, tap: [shepherd, ...others.slice(0, 2)] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, shepherd, others, staff } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: shepherd, abilityIndex: 0, tap: [shepherd, ...others] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
