// `Angelheart Protector` — the targeted ETB grant: the trigger asks, the
// answer grants derived indestructible for the turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { ANGELHEART_PROTECTOR_SCRIPT } from './angelheartProtector';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Angelheart Protector', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([ANGELHEART_PROTECTOR_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  put(g, 'p1', 'Angelheart Protector');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Angelheart Protector', () => {
  test('the entry asks for a target and grants derived indestructible', () => {
    const { g, bears } = entered();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('indestructible')).toBe(true);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('indestructible')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
