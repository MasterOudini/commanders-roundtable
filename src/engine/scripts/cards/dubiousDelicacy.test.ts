// `Dubious Delicacy` - entering shrinks the declared creature to death, or nothing
// when none is declared; the two sacrifice activations gain 3 / drain a target
// opponent 3 (the controller is refused); replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DUBIOUS_DELICACY_SCRIPT } from './dubiousDelicacy';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Dubious Delicacy';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mainPhase(g: Game): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
}

function entering(): { g: Game; self: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD], [BEARS]], scripts: createRegistry([DUBIOUS_DELICACY_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  const bears = put(g, 'p2', BEARS);
  settle(g);
  mainPhase(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, self, bears };
}

function onTheTable(): { g: Game; self: InstanceId; life0: number } {
  const g = startedGame({ players: 2, decks: [[CARD], [BEARS]], scripts: createRegistry([DUBIOUS_DELICACY_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  // Entering asks for its optional target; none is declared.
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
  settle(g);
  mainPhase(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const life0 = g.state.players.p1?.life ?? 0;
  return { g, self, life0 };
}

describe('Dubious Delicacy', () => {
  test('entering: the declared creature gets -3/-3 and dies', () => {
    const { g, bears } = entering();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('entering with no target declared resolves and shrinks nothing', () => {
    const { g, bears } = entering();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('{2}, {T}, sacrifice: you gain 3 life', () => {
    const { g, self, life0 } = onTheTable();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 + 3);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('{2}, {T}, sacrifice: target opponent loses 3 life; the controller is refused', () => {
    const { g, self } = onTheTable();
    const p2Life = g.state.players.p2?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p1' }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p2?.life).toBe(p2Life - 3);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, bears } = entering();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
