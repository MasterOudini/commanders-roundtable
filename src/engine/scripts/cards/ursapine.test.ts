// `Ursapine` — the repeatable {G} pump: no tap in the cost, so it stacks.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { URSAPINE_SCRIPT } from './ursapine';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const URSAPINE = 'Ursapine';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; ursapine: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[URSAPINE, BEARS], []],
    scripts: createRegistry([URSAPINE_SCRIPT]),
  });
  const ursapine = put(g, 'p1', URSAPINE);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  return { g, ursapine, bears };
}

function pump(g: Game, ursapine: InstanceId, bears: InstanceId): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ursapine, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
}

describe('Ursapine', () => {
  test('two activations STACK to +2/+2, and the Ursapine never turns', () => {
    const { g, ursapine, bears } = game();
    pump(g, ursapine, bears);
    pump(g, ursapine, bears);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(4);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).toughness).toBe(4);
    expect(g.state.cards[ursapine]?.tapped).toBe(false);
  });

  test('the cleanup takes both back', () => {
    const { g, ursapine, bears } = game();
    pump(g, ursapine, bears);
    pump(g, ursapine, bears);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, ursapine, bears } = game();
    pump(g, ursapine, bears);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
