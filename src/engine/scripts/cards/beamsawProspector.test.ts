// `Beamsaw Prospector` — dying makes a Lander, real on the battlefield.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BEAMSAW_PROSPECTOR_SCRIPT } from './beamsawProspector';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const PROSPECTOR = 'Beamsaw Prospector';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Beamsaw Prospector', () => {
  test('dying creates a real Lander token', () => {
    const g = startedGame({
      players: 2,
      decks: [[PROSPECTOR], []],
      scripts: createRegistry([BEAMSAW_PROSPECTOR_SCRIPT]),
    });
    const p = put(g, 'p1', PROSPECTOR);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: p, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Lander')).toHaveLength(1);
    expect(g.log.some((e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual')).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[PROSPECTOR], []],
      scripts: createRegistry([BEAMSAW_PROSPECTOR_SCRIPT]),
    });
    const p = put(g, 'p1', PROSPECTOR);
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: p, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
