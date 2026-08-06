// `Army Ants` — a land pays, a land dies — and an INDESTRUCTIBLE land
// survives while the cost stays spent (the no-refund rule).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARMY_ANTS_SCRIPT } from './armyAnts';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ANTS = 'Army Ants';
const FOUNTAIN = 'Radiant Fountain';
const CITADEL = 'Darksteel Citadel';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** The Ants tap: past summoning sickness first (CR 302.6). */
function game(targetLand: string): { g: Game; ants: InstanceId; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ANTS, FOUNTAIN], [targetLand]],
    scripts: createRegistry([ARMY_ANTS_SCRIPT]),
  });
  const ants = put(g, 'p1', ANTS);
  const mine = put(g, 'p1', FOUNTAIN);
  const theirs = put(g, 'p2', targetLand);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 20_000);
  return { g, ants, mine, theirs };
}

describe('Army Ants', () => {
  test('a land pays and the target land dies', () => {
    const { g, ants, mine, theirs } = game(FOUNTAIN);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ants, abilityIndex: 0, sacrifice: mine }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ants]?.tapped).toBe(true);
  });

  test('an INDESTRUCTIBLE land survives, and the cost stays spent', () => {
    const { g, ants, mine, theirs } = game(CITADEL);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ants, abilityIndex: 0, sacrifice: mine }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ants]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, ants, mine, theirs } = game(FOUNTAIN);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ants, abilityIndex: 0, sacrifice: mine }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
