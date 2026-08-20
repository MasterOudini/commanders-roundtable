// `Naga Oracle` — the entry asks a surveil 3; one card buried, two kept.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NAGA_ORACLE_SCRIPT } from './nagaOracle';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function oracled(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Naga Oracle'], []],
    scripts: createRegistry([NAGA_ORACLE_SCRIPT]),
  });
  settle(g);
  put(g, 'p1', 'Naga Oracle');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Naga Oracle', () => {
  test('asks a surveil 3; one buried, two kept on top', () => {
    const { g, revealed } = oracled();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.count).toBe(3);
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(true);
    expect(revealed).toHaveLength(3);
    const grave0 = (g.state.zones.graveyard['p1'] ?? []).length;
    const bury = revealed[0] as InstanceId;
    must(
      g.submit({
        t: 'AnswerScry',
        player: 'p1',
        toTop: revealed.slice(1),
        toBottom: [bury],
      }),
    );
    settle(g);
    expect(g.state.cards[bury]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(grave0 + 1);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = oracled();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
