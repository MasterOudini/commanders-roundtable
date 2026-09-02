// `Blighted Shaman` — a Swamp buys +1/+1, a creature buys +2/+2, and a
// creature is refused as the Swamp price.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLIGHTED_SHAMAN_SCRIPT } from './blightedShaman';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SHAMAN = 'Blighted Shaman';
const BEARS = 'Grizzly Bears';
const SWAMP = 'Swamp';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; shaman: InstanceId; swamp: InstanceId; target: InstanceId; fodder: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SHAMAN, BEARS, BEARS, SWAMP], []],
    scripts: createRegistry([BLIGHTED_SHAMAN_SCRIPT]),
  });
  const swamp = put(g, 'p1', SWAMP);
  const target = put(g, 'p1', BEARS);
  const fodder = put(g, 'p1', BEARS);
  const shaman = put(g, 'p1', SHAMAN);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, shaman, swamp, target, fodder };
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([BLIGHTED_SHAMAN_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Blighted Shaman', () => {
  test('{T}, sacrifice a Swamp: +1/+1', () => {
    const { g, shaman, swamp, target } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: shaman, abilityIndex: 0, sacrifice: swamp }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(pt(g, target)).toEqual({ power: 3, toughness: 3 });
    expect(g.state.cards[swamp]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[shaman]?.tapped).toBe(true);
  });

  test('{T}, sacrifice a creature: +2/+2', () => {
    const { g, shaman, target, fodder } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: shaman, abilityIndex: 1, sacrifice: fodder }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(pt(g, target)).toEqual({ power: 4, toughness: 4 });
    expect(g.state.cards[fodder]?.zone.kind).toBe('graveyard');
  });

  test('a creature is refused as the Swamp price', () => {
    const { g, shaman, fodder } = board();
    const res = g.submit({ t: 'ActivateAbility', player: 'p1', card: shaman, abilityIndex: 0, sacrifice: fodder });
    expect(res.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, shaman, swamp, target } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: shaman, abilityIndex: 0, sacrifice: swamp }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
