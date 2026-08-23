// `Underground Mortuary` — enters tapped, and the entry asks the surveil.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UNDERGROUND_MORTUARY_SCRIPT } from './undergroundMortuary';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LAND = 'Underground Mortuary';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; land: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[LAND], []],
    scripts: createRegistry([UNDERGROUND_MORTUARY_SCRIPT]),
  });
  const land = put(g, 'p1', LAND);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  return { g, land, revealed: lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) };
}

describe('Underground Mortuary', () => {
  test('it enters TAPPED and the entry asks a SURVEIL', () => {
    const { g, land, revealed } = entered();
    expect(g.state.cards[land]?.tapped).toBe(true);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(true);
    expect(revealed).toHaveLength(1);
  });

  test('declining puts the card in the GRAVEYARD, not the bottom', () => {
    const { g, revealed } = entered();
    const card = revealed[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [card] }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = entered();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
