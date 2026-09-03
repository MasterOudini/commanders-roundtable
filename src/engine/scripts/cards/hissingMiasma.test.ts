// `Hissing Miasma` - two creatures attacking its controller cost the attacker 2 life
// (one trigger per creature); replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HISSING_MIASMA_SCRIPT } from './hissingMiasma';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Hissing Miasma';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): { g: Game; a: InstanceId; b: InstanceId; life0: { p1: number; p2: number } } {
  const g = startedGame({ players: 2, decks: [[CARD], [BEARS, BEARS]], scripts: createRegistry([HISSING_MIASMA_SCRIPT]) });
  holdEverywhere(g);
  put(g, 'p1', CARD);
  const a = put(g, 'p2', BEARS);
  const b = put(g, 'p2', BEARS);
  settle(g);
  const life0 = { p1: g.state.players.p1?.life ?? 0, p2: g.state.players.p2?.life ?? 0 };
  // p2's turn 2: both Bears attack p1.
  advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p2',
      attackers: [
        { card: a, defender: { kind: 'player', id: 'p1' } },
        { card: b, defender: { kind: 'player', id: 'p1' } },
      ],
    }),
  );
  advanceUntil(g, (s) => s.priority.player !== null && s.priority.awaiting === null && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  settle(g);
  return { g, a, b, life0 };
}

describe('Hissing Miasma', () => {
  test('each creature attacking its controller costs the attacker 1 life', () => {
    const { g, life0 } = attacked();
    expect(g.state.players.p2?.life).toBe(life0.p2 - 2);
  });

  test('replays to the same hash', () => {
    const { g } = attacked();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
