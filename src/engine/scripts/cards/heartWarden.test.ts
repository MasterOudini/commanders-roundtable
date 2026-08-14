// `Heart Warden` — {2} and its own body pay for the draw; the sacrifice is
// the COST batch's (D159), so the Warden is gone whether or not anything
// responds.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HEART_WARDEN_SCRIPT } from './heartWarden';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WARDEN = 'Heart Warden';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; warden: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WARDEN], []],
    scripts: createRegistry([HEART_WARDEN_SCRIPT]),
  });
  const warden = put(g, 'p1', WARDEN);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, warden };
}

describe('Heart Warden', () => {
  test('paying {2} and itself draws a card', () => {
    const { g, warden } = board();
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: warden, abilityIndex: 1 }));
    settle(g);
    expect(g.state.cards[warden]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g, warden } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: warden, abilityIndex: 1 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
