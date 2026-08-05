// `Yotian Dissident` — the SHIPPED targeted trigger. Its behaviour is driven
// exhaustively by `src/engine/targetedTrigger.test.ts` (which imports this
// module since the dedup); this file pins the replay property under the
// shipped registry.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { YOTIAN_DISSIDENT_SCRIPT } from './yotianDissident';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

describe('Yotian Dissident', () => {
  test('an artifact entering raises the targeted trigger, and the game replays', () => {
    const g: Game = startedGame({
      players: 2,
      decks: [['Yotian Dissident', 'Darksteel Citadel'], []],
      scripts: createRegistry([YOTIAN_DISSIDENT_SCRIPT]),
    });
    const self = put(g, 'p1', 'Yotian Dissident');
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    put(g, 'p1', 'Darksteel Citadel');
    // CR 603.3d — the targets prompt is up in the same pass.
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: self }] }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.cards[self]?.counters['+1/+1']).toBe(1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
