// `Octoprophet` — the entry asks a scry 2 that bottoms.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OCTOPROPHET_SCRIPT } from './octoprophet';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function prophesied(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Octoprophet'], []],
    scripts: createRegistry([OCTOPROPHET_SCRIPT]),
  });
  settle(g);
  put(g, 'p1', 'Octoprophet');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Octoprophet', () => {
  test('the entry asks a scry 2; one bottomed, one kept', () => {
    const { g, revealed } = prophesied();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.count).toBe(2);
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(false);
    expect(revealed).toHaveLength(2);
    const bottom = revealed[0] as InstanceId;
    must(
      g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed.slice(1), toBottom: [bottom] }),
    );
    settle(g);
    expect((g.state.zones.library['p1'] ?? [])[0]).toBe(bottom);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = prophesied();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
