// `Lush Portico` — the surveil land's Forest-Plains twin: tapped entry,
// then the ask.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LUSH_PORTICO_SCRIPT } from './lushPortico';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function porticoed(): { g: Game; portico: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Lush Portico'], ['Grizzly Bears']],
    scripts: createRegistry([LUSH_PORTICO_SCRIPT]),
  });
  settle(g);
  const portico = put(g, 'p1', 'Lush Portico');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, portico, revealed };
}

describe('Lush Portico', () => {
  test('enters TAPPED and asks a surveil 1; the graveyard answer buries the card', () => {
    const { g, portico, revealed } = porticoed();
    expect(g.state.cards[portico]?.tapped).toBe(true);
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(true);
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(g.state.cards[revealed[0] as InstanceId]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = porticoed();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
