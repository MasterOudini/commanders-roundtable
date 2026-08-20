// `Lothlórien Lookout` — attacking asks a scry 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LOTHLORIEN_LOOKOUT_SCRIPT } from './lothlorienLookout';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function looked(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Lothlórien Lookout'], []],
    scripts: createRegistry([LOTHLORIEN_LOOKOUT_SCRIPT]),
  });
  const lookout = put(g, 'p1', 'Lothlórien Lookout');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: lookout, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Lothlórien Lookout', () => {
  test('the attack asks a scry 1 (top stays on the keep answer)', () => {
    const { g, revealed } = looked();
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(false);
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const { g, revealed } = looked();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
