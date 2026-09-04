// `Blood Fountain` - entering makes a Blood token; the sacrifice activation returns
// two declared creature cards from the graveyard; an instant card is refused;
// replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLOOD_FOUNTAIN_SCRIPT } from './bloodFountain';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Blood Fountain';
const BEARS = 'Grizzly Bears';
const HAWK = 'Vampire Nighthawk';
const BOLT = 'Lightning Bolt';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBattlefield(g: Game, player: 'p1' | 'p2'): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === player).length;
}

function armed(): { g: Game; self: InstanceId; bears: InstanceId; hawk: InstanceId; bolt: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, BEARS, HAWK, BOLT], [BEARS]], scripts: createRegistry([BLOOD_FOUNTAIN_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  const bears = put(g, 'p1', BEARS, 'graveyard');
  const hawk = put(g, 'p1', HAWK, 'graveyard');
  const bolt = put(g, 'p1', BOLT, 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, self, bears, hawk, bolt };
}

describe('Blood Fountain', () => {
  test('entering creates a Blood token', () => {
    const g = startedGame({ players: 2, decks: [[CARD], [BEARS]], scripts: createRegistry([BLOOD_FOUNTAIN_SCRIPT]) });
    holdEverywhere(g);
    const before = onBattlefield(g, 'p1');
    put(g, 'p1', CARD);
    settle(g);
    expect(onBattlefield(g, 'p1')).toBe(before + 2);
  });

  test('{3}{B}, {T}, sacrifice: both declared creature cards return to hand', () => {
    const { g, self, bears, hawk } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }, { kind: 'card', id: hawk }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect(g.state.cards[hawk]?.zone.kind).toBe('hand');
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('an instant card is refused (D299)', () => {
    const { g, bolt } = armed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bolt }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, bears, hawk } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }, { kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
