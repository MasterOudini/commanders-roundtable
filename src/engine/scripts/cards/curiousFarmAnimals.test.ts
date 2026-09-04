// `Curious Farm Animals` - dying gains 3 life; the sacrifice activation destroys a
// declared artifact (and the death trigger still pays its 3); a creature is
// refused; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CURIOUS_FARM_ANIMALS_SCRIPT } from './curiousFarmAnimals';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Curious Farm Animals';
const RING = 'Sol Ring';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; ring: InstanceId; bears: InstanceId; life0: number } {
  const g = startedGame({ players: 2, decks: [[CARD], [RING, BEARS]], scripts: createRegistry([CURIOUS_FARM_ANIMALS_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  const ring = put(g, 'p2', RING);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  return { g, self, ring, bears, life0 };
}

describe('Curious Farm Animals', () => {
  test('dying gains its controller 3 life', () => {
    const { g, self, life0 } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 + 3);
  });

  test('{2}, sacrifice: the declared artifact is destroyed, and the death trigger still pays', () => {
    const { g, self, ring, life0 } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(life0 + 3);
  });

  test('a creature is refused (D299)', () => {
    const { g, self, bears } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, self, ring } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
