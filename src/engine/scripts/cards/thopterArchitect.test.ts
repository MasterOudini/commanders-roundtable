// `Thopter Architect` — an artifact of mine entering grants flying; a
// non-artifact creature of mine asks nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THOPTER_ARCHITECT_SCRIPT } from './thopterArchitect';
import { derive } from '../../derive';
import { advanceUntil, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ARCHITECT = 'Thopter Architect';
const ARTIFACT = 'Sol Ring';
const CREATURE = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(name: string): { g: Game; aim: InstanceId; asked: boolean } {
  const g = startedGame({
    players: 2,
    decks: [[ARCHITECT, ARTIFACT, CREATURE], []],
    scripts: createRegistry([THOPTER_ARCHITECT_SCRIPT]),
  });
  const aim = put(g, 'p1', CREATURE);
  put(g, 'p1', ARCHITECT);
  settle(g);
  put(g, 'p1', name);
  const asked = g.state.priority.awaiting?.kind === 'chooseTargets';
  if (asked) {
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: aim }] }));
  }
  settle(g);
  return { g, aim, asked };
}

describe('Thopter Architect', () => {
  test('an ARTIFACT entering grants flying', () => {
    const { g, aim, asked } = entered(ARTIFACT);
    expect(asked).toBe(true);
    expect(derive(g.state, ORACLE, g.deps.scripts, aim).keywords.has('flying')).toBe(true);
  });

  test('a plain creature entering asks nothing', () => {
    expect(entered(CREATURE).asked).toBe(false);
  });

  test('the grant ends at cleanup, and it replays to the same hash', () => {
    const { g, aim } = entered(ARTIFACT);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, aim).keywords.has('flying')).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
