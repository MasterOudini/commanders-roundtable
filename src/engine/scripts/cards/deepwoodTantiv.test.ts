// `Deepwood Tantiv` — becoming blocked pays 2 life; an unblocked swing pays
// nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEEPWOOD_TANTIV_SCRIPT } from './deepwoodTantiv';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TANTIV = 'Deepwood Tantiv';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacking(): { g: Game; tantiv: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TANTIV], [BEARS]],
    scripts: createRegistry([DEEPWOOD_TANTIV_SCRIPT]),
  });
  const tantiv = put(g, 'p1', TANTIV);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers',
    20_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: tantiv, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
  return { g, tantiv, bears };
}

describe('Deepwood Tantiv', () => {
  test('becoming blocked gains 2 life, once, however combat ends', () => {
    const { g, tantiv, bears } = attacking();
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: bears, attacker: tantiv }] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 2);
  });

  test('an UNBLOCKED attack pays nothing', () => {
    const { g } = attacking();
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.step === 'postcombatMain' || s.gamePhase === 'finished', 20_000);
    expect(g.state.players['p1']?.life).toBe(lifeBefore);
  });

  test('replays to the same hash', () => {
    const { g, tantiv, bears } = attacking();
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: bears, attacker: tantiv }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
