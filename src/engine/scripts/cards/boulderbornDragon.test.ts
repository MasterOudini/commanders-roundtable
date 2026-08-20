// `Boulderborn Dragon` — the attacks-surveil behind a two-keyword line.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BOULDERBORN_DRAGON_SCRIPT } from './boulderbornDragon';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function attacked(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Boulderborn Dragon', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([BOULDERBORN_DRAGON_SCRIPT]),
  });
  const dragon = put(g, 'p1', 'Boulderborn Dragon');
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
      attackers: [{ card: dragon, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Boulderborn Dragon', () => {
  test('attacking asks with toGraveyard SET', () => {
    const { g, revealed } = attacked();
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(true);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(g.state.cards[revealed[0] as InstanceId]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = attacked();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
