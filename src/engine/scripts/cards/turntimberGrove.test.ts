// `Turntimber Grove` — the targeted ETB pump on a land that enters tapped.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { TURNTIMBER_GROVE_SCRIPT } from './turntimberGrove';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GROVE = 'Turntimber Grove';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function grown(): { g: Game; grove: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GROVE, BEARS], []],
    scripts: createRegistry([TURNTIMBER_GROVE_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  const grove = put(g, 'p1', GROVE);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, grove, bears };
}

describe('Turntimber Grove', () => {
  test('it enters TAPPED and its entry pumps the chosen creature', () => {
    const { g, grove, bears } = grown();
    expect(g.state.cards[grove]?.tapped).toBe(true);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(3);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).toughness).toBe(3);
  });

  test('the cleanup takes the pump back', () => {
    const { g, bears } = grown();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = grown();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
