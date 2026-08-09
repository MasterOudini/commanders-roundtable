// `Flamewave Invoker` — five to the face; a creature is refused at the
// aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FLAMEWAVE_INVOKER_SCRIPT } from './flamewaveInvoker';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const INVOKER = 'Flamewave Invoker';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; invoker: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[INVOKER], [BEARS]],
    scripts: createRegistry([FLAMEWAVE_INVOKER_SCRIPT]),
  });
  const invoker = put(g, 'p1', INVOKER);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 7 }));
  return { g, invoker, theirs };
}

describe('Flamewave Invoker', () => {
  test('five damage to the player; a CREATURE is refused at the aim', () => {
    const { g, invoker, theirs } = armed();
    const lifeBefore = g.state.players['p2']?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: invoker, abilityIndex: 0 }));
    const wrong = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] });
    expect(wrong.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(lifeBefore - 5);
  });

  test('replays to the same hash', () => {
    const { g, invoker } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: invoker, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
