// `Archon of Justice` — the first trigger that both LOOKS BACK and TARGETS:
// the death fires it, the prompt is asked afterwards, and the exile lands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARCHON_OF_JUSTICE_SCRIPT } from './archonOfJustice';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ARCHON = 'Archon of Justice';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Archon of Justice', () => {
  test('dying exiles the chosen permanent — even an indestructible one', () => {
    const g = startedGame({
      players: 2,
      decks: [[ARCHON], ['Darksteel Myr']],
      scripts: createRegistry([ARCHON_OF_JUSTICE_SCRIPT]),
    });
    const myr = put(g, 'p2', 'Darksteel Myr');
    settle(g);
    const archon = put(g, 'p1', ARCHON);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: archon, to: { kind: 'graveyard', player: 'p1' } }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: myr }] }));
    settle(g);
    // Exile is not destruction — indestructible does not apply (CR 701.7).
    expect(g.state.cards[myr]?.zone.kind).toBe('exile');
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[ARCHON], ['Darksteel Myr']],
      scripts: createRegistry([ARCHON_OF_JUSTICE_SCRIPT]),
    });
    const myr = put(g, 'p2', 'Darksteel Myr');
    settle(g);
    const archon = put(g, 'p1', ARCHON);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: archon, to: { kind: 'graveyard', player: 'p1' } }));
    if (g.state.priority.awaiting?.kind === 'chooseTargets') {
      must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: myr }] }));
    }
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
