// `A.I.M. Synthoids` — the ETB surveil trigger: the creature arrives, the
// prompt rises, the reject goes to the graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AIM_SYNTHOIDS_SCRIPT } from './aimSynthoids';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['A.I.M. Synthoids', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([AIM_SYNTHOIDS_SCRIPT]),
  });
  put(g, 'p1', 'A.I.M. Synthoids');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('A.I.M. Synthoids', () => {
  test('the entry asks a surveil 2, and a bottomed card is a GRAVEYARD card', () => {
    const { g, revealed } = entered();
    expect(revealed.length).toBe(2);
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(true);
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [b], toBottom: [a] }));
    settle(g);
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = entered();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [...revealed].reverse(), toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
