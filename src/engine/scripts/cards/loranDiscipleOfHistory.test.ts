// `Loran, Disciple of History` - Loran entering returns an artifact card; another
// legendary creature entering does too; a non-legendary one does not; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LORAN_DISCIPLE_OF_HISTORY_SCRIPT } from './loranDiscipleOfHistory';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Loran, Disciple of History';
const RING = 'Sol Ring';
const CALERIA = 'Lady Caleria'; // legendary
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; self: InstanceId; ring: InstanceId; caleria: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, RING, CALERIA, BEARS], [BEARS]], scripts: createRegistry([LORAN_DISCIPLE_OF_HISTORY_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  const ring = put(g, 'p1', RING, 'graveyard');
  const caleria = put(g, 'p1', CALERIA, 'graveyard');
  const bears = put(g, 'p1', BEARS, 'graveyard');
  settle(g);
  return { g, self, ring, caleria, bears };
}

describe('Loran, Disciple of History', () => {
  test('Loran entering returns the artifact card to hand', () => {
    const { g, self, ring } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    expect(g.state.cards[ring]?.zone.kind).toBe('hand');
  });

  test('another legendary creature entering triggers it; a plain creature does not', () => {
    const { g, self, ring, caleria, bears } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: ring, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    expect(g.state.priority.awaiting?.kind ?? null).not.toBe('chooseTargets');
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: caleria, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    expect(g.state.cards[ring]?.zone.kind).toBe('hand');
  });

  test('replays to the same hash', () => {
    const { g, self, ring } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
