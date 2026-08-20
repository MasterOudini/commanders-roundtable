// `Citywatch Sphinx` — the first DIES-ask: death raises the surveil.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CITYWATCH_SPHINX_SCRIPT } from './citywatchSphinx';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function died(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Citywatch Sphinx', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([CITYWATCH_SPHINX_SCRIPT]),
  });
  const sphinx = put(g, 'p1', 'Citywatch Sphinx');
  settle(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: sphinx, to: { kind: 'graveyard', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Citywatch Sphinx', () => {
  test('dying asks with toGraveyard SET, two revealed', () => {
    const { g, revealed } = died();
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(true);
    expect(revealed).toHaveLength(2);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(g.state.cards[revealed[0] as InstanceId]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = died();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
