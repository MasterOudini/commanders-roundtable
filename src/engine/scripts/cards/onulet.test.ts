// `Onulet` — the first shipped DIES trigger, and the file that pins the one
// behavioural difference from the testing copy it replaced: "you" is who
// controlled the creature AS IT DIED (`obj.controller`, CR 603.3d), not the
// dead card's owner. A stolen Onulet pays the thief.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ONULET_SCRIPT } from './onulet';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ONULET = 'Onulet';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[ONULET], []],
    scripts: createRegistry([ONULET_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kill(g: Game, id: InstanceId, owner: 'p1' | 'p2' = 'p1'): void {
  must(
    g.submit({ t: 'ManualMoveCard', player: owner, card: id, to: { kind: 'graveyard', player: owner } }),
  );
  settle(g);
}

describe('Onulet', () => {
  test('dying gains its controller 2 — the look-back at work', () => {
    const g = game();
    const id = put(g, 'p1', ONULET);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(40);
    kill(g, id);
    expect(g.state.players['p1']?.life).toBe(42);
    expect(
      g.log.some((e) => e.body.t === 'LifeChanged' && e.body.player === 'p1' && e.body.delta === 2),
    ).toBe(true);
  });

  test('a BOUNCE is not a death — battlefield to hand gains nothing', () => {
    const g = game();
    const id = put(g, 'p1', ONULET);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'hand', player: 'p1' } }),
    );
    settle(g);
    expect(g.state.players['p1']?.life).toBe(40);
    expect(g.log.some((e) => e.body.t === 'LifeChanged')).toBe(false);
  });

  /**
   * ⚠️ THE CASE THAT SEPARATES `obj.controller` FROM THE OWNER-READ the testing
   * copy shipped with. p2 steals the Onulet; it still dies into its OWNER's
   * graveyard (CR 404.1), but "you gain 2 life" is the player who controlled it
   * as it died — the thief.
   */
  test('a STOLEN Onulet pays the thief, not the owner', () => {
    const g = game();
    const id = put(g, 'p1', ONULET);
    settle(g);
    must(g.submit({ t: 'ManualSetController', player: 'p1', card: id, controller: 'p2' }));
    settle(g);
    kill(g, id, 'p1');
    expect(g.state.players['p2']?.life).toBe(42);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = game();
    const id = put(g, 'p1', ONULET);
    settle(g);
    kill(g, id);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
