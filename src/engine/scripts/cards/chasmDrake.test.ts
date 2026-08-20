// `Chasm Drake` — its attack asks for MY creature and grants derived
// flying.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CHASM_DRAKE_SCRIPT } from './chasmDrake';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Chasm Drake', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([CHASM_DRAKE_SCRIPT]),
  });
  const drake = put(g, 'p1', 'Chasm Drake');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: drake, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Chasm Drake', () => {
  test('the attack grants derived flying to the chosen creature', () => {
    const { g, bears } = attacked();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('flying')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = attacked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
