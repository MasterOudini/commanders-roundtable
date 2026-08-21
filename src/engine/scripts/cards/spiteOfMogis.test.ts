// `Spite of Mogis` — the census damage lands FIRST, then the scry ask.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPITE_OF_MOGIS_SCRIPT } from './spiteOfMogis';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spited(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Spite of Mogis', 'Lightning Bolt', 'Lightning Bolt', 'Grizzly Bears'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([SPITE_OF_MOGIS_SCRIPT]),
  });
  put(g, 'p1', 'Lightning Bolt', 'graveyard');
  put(g, 'p1', 'Lightning Bolt', 'graveyard');
  put(g, 'p1', 'Grizzly Bears', 'graveyard');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Spite of Mogis', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const top = lib[lib.length - 1];
  if (top === undefined) throw new Error('empty library');
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [top], toBottom: [] }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  return { g, bears };
}

describe('Spite of Mogis', () => {
  test('two instants make 2 — the Bears dies; the dead creature counts not', () => {
    const { g, bears } = spited();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = spited();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
